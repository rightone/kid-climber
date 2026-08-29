const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { spawn, spawnSync } = require('node:child_process');

const detectRustHost = () => {
  const result = spawnSync('rustc', ['-vV'], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error('SIDECAR_TARGET is required when the Rust host target cannot be detected');
  }
  const hostLine = result.stdout.split(/\r?\n/).find(line => line.startsWith('host: '));
  if (!hostLine) {
    throw new Error('Rust host target was not present in rustc -vV output');
  }
  return hostLine.slice('host: '.length).trim();
};

const target = process.env.SIDECAR_TARGET || detectRustHost();
const extension = target.includes('windows') ? '.exe' : '';
const binaryPath = path.resolve(
  __dirname,
  '..',
  'src-tauri',
  'binaries',
  `kid-climber-server-${target}${extension}`
);

if (!fs.existsSync(binaryPath) || fs.statSync(binaryPath).size === 0) {
  throw new Error(`Sidecar is missing for ${target}`);
}

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'kid-climber-sidecar-'));
const databasePath = path.join(temporaryDirectory, 'smoke.db');
const child = spawn(binaryPath, ['--listen', '127.0.0.1:0', '--database', databasePath], {
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let stderr = '';
child.stderr.on('data', chunk => {
  stderr = `${stderr}${chunk.toString()}`.slice(-2000);
});

const ready = new Promise((resolve, reject) => {
  const lines = readline.createInterface({ input: child.stdout });
  lines.on('line', line => {
    try {
      const event = JSON.parse(line);
      if (event.event === 'ready' && typeof event.api_url === 'string') {
        resolve(event.api_url);
      }
    } catch {
      // The readiness contract is a JSON line; other stdout is ignored.
    }
  });
  child.once('error', reject);
  child.once('exit', code => reject(new Error(`Sidecar exited before readiness (code ${code})`)));
});

let timeoutHandle;
const timeout = new Promise((_, reject) => {
  timeoutHandle = setTimeout(() => reject(new Error('Sidecar readiness timed out')), 20_000);
});

const run = async () => {
  try {
    const apiUrl = await Promise.race([ready, timeout]);
    clearTimeout(timeoutHandle);
    const healthUrl = new URL('/health', apiUrl);
    if (healthUrl.hostname !== '127.0.0.1') {
      throw new Error('Sidecar readiness did not return a loopback URL');
    }
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      throw new Error(`Sidecar health returned ${response.status}`);
    }
    const health = await response.json();
    if (health.status !== 'ok') {
      throw new Error('Sidecar health payload was not ready');
    }
    if (!fs.existsSync(databasePath) || fs.statSync(databasePath).size === 0) {
      throw new Error('Sidecar did not create its requested database');
    }
    console.log(`Sidecar health smoke passed for ${target}`);
  } catch (error) {
    if (stderr) {
      console.error('Sidecar emitted stderr before the smoke test failed.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill();
      await Promise.race([
        exited,
        new Promise(resolve => setTimeout(resolve, 5000)),
      ]);
    }
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
};

run().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
