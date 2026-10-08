import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function loadAdapter(platform: string, available: boolean) {
  const exports: Record<string, any> = {};
  let imports = 0;
  const calls: unknown[][] = [];
  const api = { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 3,
    getItemAsync: async (...args: unknown[]) => { calls.push(args); return 'saved'; },
    setItemAsync: async (...args: unknown[]) => { calls.push(args); },
    deleteItemAsync: async (...args: unknown[]) => { calls.push(args); },
  };
  const source = readFileSync(new URL('../src/auth/session-storage.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  runInNewContext(compiled.outputText, { exports, require: (name: string) => {
    if (name === 'react-native') return { Platform: { OS: platform } };
    if (name === 'expo') return { requireOptionalNativeModule: () => available ? {} : null };
    if (name === 'expo-secure-store') {
      imports++;
      if (!available) throw Error("Cannot find native module 'ExpoSecureStore'");
      return api;
    }
    throw Error(`Unexpected module ${name}`);
  } });
  return { exports, imports: () => imports, calls };
}

test('older native builds start safely without importing the missing SecureStore module', async () => {
  for (const platform of ['ios', 'android']) {
    const adapter = loadAdapter(platform, false);
    assert.equal(adapter.imports(), 0);
    assert.throws(() => adapter.exports.checkSessionStorage(), adapter.exports.SecureStorageBuildError);
    await assert.rejects(adapter.exports.sessionStorage.read(), adapter.exports.SecureStorageBuildError);
    await assert.rejects(adapter.exports.sessionStorage.write('secret'), adapter.exports.SecureStorageBuildError);
    await assert.rejects(adapter.exports.sessionStorage.clear(), adapter.exports.SecureStorageBuildError);
    assert.equal(adapter.imports(), 0);
  }
});

test('rebuilt native apps read/write/delete securely with device-only keychain options', async () => {
  const adapter = loadAdapter('ios', true);
  assert.equal(await adapter.exports.sessionStorage.read(), 'saved');
  await adapter.exports.sessionStorage.write('secret');
  await adapter.exports.sessionStorage.clear();
  assert.equal(adapter.calls.length, 3);
  assert.equal(JSON.stringify(adapter.calls[1]), JSON.stringify(['savly.auth.session.v1', 'secret', { keychainAccessible: 3 }]));
});

test('browser previews never import native secure storage or persist credentials', async () => {
  const adapter = loadAdapter('web', false);
  adapter.exports.checkSessionStorage();
  assert.equal(await adapter.exports.sessionStorage.read(), null);
  await adapter.exports.sessionStorage.write('secret');
  await adapter.exports.sessionStorage.clear();
  assert.equal(adapter.imports(), 0);
});
