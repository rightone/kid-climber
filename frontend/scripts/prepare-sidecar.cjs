const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TARGETS = {
  'x86_64-pc-windows-msvc': { goos: 'windows', goarch: 'amd64', extension: '.exe' },
  'x86_64-unknown-linux-gnu': { goos: 'linux', goarch: 'amd64', extension: '' },
  'aarch64-apple-darwin': { goos: 'darwin', goarch: 'arm64', extension: '' },
  'x86_64-apple-darwin': { goos: 'darwin', goarch: 'amd64', extension: '' },
};

const frontendRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(frontendRoot, '..');
const backendRoot = path.join(repositoryRoot, 'backend');
const outputDirectory = path.join(frontendRoot, 'src-tauri', 'binaries');

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
const targetConfig = TARGETS[target];
if (!targetConfig) {
  throw new Error(`Unsupported sidecar target: ${target}`);
}

fs.mkdirSync(outputDirectory, { recursive: true });
const outputPath = path.join(
  outputDirectory,
  `kid-climber-server-${target}${targetConfig.extension}`
);

const result = spawnSync(
  'go',
  ['build', '-trimpath', '-ldflags=-s -w', '-o', outputPath, './cmd/server'],
  {
    cwd: backendRoot,
    env: {
      ...process.env,
      CGO_ENABLED: '1',
      GOOS: targetConfig.goos,
      GOARCH: targetConfig.goarch,
      GOPROXY: process.env.GOPROXY || 'https://proxy.golang.org,direct',
    },
    stdio: 'inherit',
  }
);

if (result.error) {
  throw result.error;
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
if (!fs.statSync(outputPath).isFile() || fs.statSync(outputPath).size === 0) {
  throw new Error('Sidecar build did not produce a non-empty binary');
}

console.log(`Prepared Tauri sidecar for ${target}`);
