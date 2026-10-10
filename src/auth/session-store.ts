import { SessionExpiredError, type Session } from './cognito';

export interface SessionStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  clear(): Promise<void>;
}

function decode(raw: string, scope: string): Session | null {
  try {
    const value = JSON.parse(raw);
    const s = value.session;
    if (value.scope !== scope || !s || typeof s.accessToken !== 'string' || !s.accessToken ||
      (s.authMethod !== undefined && s.authMethod !== 'native') ||
      !Number.isFinite(s.expiresAt) || typeof s.user?.sub !== 'string' || !s.user.sub ||
      (s.user.email !== undefined && typeof s.user.email !== 'string') ||
      (s.refreshToken !== undefined && (typeof s.refreshToken !== 'string' || !s.refreshToken))) return null;
    return s;
  } catch { return null; }
}

// Serialize disk changes and invalidate late network results when signing out.
export class SessionStore {
  session: Session | null = null;
  private generation = 0;
  private signingOut = false;
  private writes: Promise<void> = Promise.resolve();
  private refreshing: Promise<void> | null = null;
  constructor(private storage: SessionStorage, private scope: string,
    private renew: (session: Session) => Promise<Session>, private changed: (session: Session | null) => void,
    private now = Date.now) {}

  private enqueue(work: () => Promise<void>): Promise<void> {
    const pending = this.writes.then(work, work);
    this.writes = pending.catch(() => {});
    return pending;
  }

  async restore(): Promise<void> {
    const generation = this.generation;
    const raw = await this.storage.read();
    if (generation !== this.generation || !raw) return;
    const saved = decode(raw, this.scope);
    if (!saved) { await this.signOut(); return; }
    this.session = saved;
    // Refresh expired credentials before exposing a restored identity.
    if (saved.expiresAt <= this.now()) await this.refresh();
    else this.changed(saved);
  }

  async accept(session: Session): Promise<void> {
    if (this.signingOut) return;
    const generation = this.generation;
    await this.enqueue(async () => {
      if (generation !== this.generation) return;
      await this.storage.write(JSON.stringify({ scope: this.scope, session }));
      if (generation === this.generation) { this.session = session; this.changed(session); }
    });
  }

  refresh(): Promise<void> {
    if (this.signingOut) return Promise.resolve();
    if (this.refreshing) return this.refreshing;
    const previous = this.session;
    if (!previous) return Promise.resolve();
    const generation = this.generation;
    const pending = (async () => {
      try {
        const next = await this.renew(previous);
        if (generation === this.generation) await this.accept(next);
      } catch (error) {
        if (generation !== this.generation) return;
        if (error instanceof SessionExpiredError) await this.signOut();
        else throw error; // Offline/server failures retain secure credentials for retry.
      }
    })();
    this.refreshing = pending;
    void pending.finally(() => { if (this.refreshing === pending) this.refreshing = null; }).catch(() => {});
    return pending;
  }

  async signOut(): Promise<void> {
    this.generation++;
    this.signingOut = true;
    this.refreshing = null;
    try {
      await this.enqueue(() => this.storage.clear());
      this.session = null;
      this.changed(null);
    } finally { this.signingOut = false; }
  }
}
