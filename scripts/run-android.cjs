// Use an installed Java 17 and Android SDK without changing the user's shell settings.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const userDirectory = os.homedir();
const javaExecutable = process.platform === 'win32' ? 'java.exe' : 'java';

function isJava17(directory) {
  if (!directory || !fs.existsSync(path.join(directory, 'bin', javaExecutable))) return false;
  const result = spawnSync(path.join(directory, 'bin', javaExecutable), ['-version'], { encoding: 'utf8' });
  return result.status === 0 && /version "17[.\"]/.test(result.stderr + result.stdout);
}

function findJava17(directory, depth = 5) {
  if (isJava17(directory)) return directory;
  if (!depth || !directory || !fs.existsSync(directory)) return null;
  for (const child of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!child.isDirectory() || child.name.startsWith('.')) continue;
    const found = findJava17(path.join(directory, child.name), depth - 1);
    if (found) return found;
  }
  return null;
}

function main() {
  const candidates = [process.env.JAVA_HOME];
  if (process.platform === 'darwin') {
    const result = spawnSync('/usr/libexec/java_home', ['-v', '17'], { encoding: 'utf8' });
    if (result.status === 0) candidates.push(result.stdout.trim());
  }
  candidates.push(
    path.join(userDirectory, '.gradle', 'jdks'),
    path.join(userDirectory, 'Library', 'Java', 'JavaVirtualMachines'),
    '/Library/Java/JavaVirtualMachines', '/usr/lib/jvm',
    '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home',
  );
  let javaHome;
  for (const candidate of candidates) {
    if (!candidate) continue;
    javaHome = findJava17(candidate);
    if (javaHome) break;
  }
  if (!javaHome) throw new Error('Java 17 was not found. Install JDK 17 or set JAVA_HOME to its installation directory, then retry npm run android.');

  const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
    path.join(userDirectory, 'Library', 'Android', 'sdk'), path.join(userDirectory, 'Android', 'Sdk'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')]
    .find(directory => directory && fs.existsSync(path.join(directory, 'platform-tools')));
  if (!sdk) throw new Error('Android SDK was not found. Install it through Android Studio or set ANDROID_HOME, then retry npm run android.');

  console.log(`Using Java 17: ${javaHome}`);
  console.log(`Using Android SDK: ${sdk}`);
  if (process.argv.includes('--check')) return;
  const child = spawn(process.execPath, [require.resolve('expo/bin/cli'), 'run:android', ...process.argv.slice(2)], {
    cwd: root, stdio: 'inherit', env: { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk,
      NODE_ENV: ['development', 'production', 'test'].includes(process.env.NODE_ENV) ? process.env.NODE_ENV : 'development' },
  });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
