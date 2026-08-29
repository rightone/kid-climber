const fs = require('node:fs');
const path = require('node:path');

const frontendRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(frontendRoot, '..');
const expectedVersion = '3.0.0-alpha.3';

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const packageJson = JSON.parse(read('frontend/package.json'));
const packageLock = JSON.parse(read('frontend/package-lock.json'));
const tauriConfig = JSON.parse(read('frontend/src-tauri/tauri.conf.json'));
const cargoToml = read('frontend/src-tauri/Cargo.toml');
const cargoLock = read('frontend/src-tauri/Cargo.lock');
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const goVersion = read('backend/go.mod').match(/^go\s+([^\s]+)$/m)?.[1];

assert(packageJson.version === expectedVersion, 'frontend/package.json version mismatch');
assert(packageLock.version === expectedVersion, 'frontend/package-lock.json version mismatch');
assert(packageLock.packages[''].version === expectedVersion, 'package-lock root version mismatch');
assert(tauriConfig.package.version === expectedVersion, 'tauri.conf.json version mismatch');
assert(cargoVersion === expectedVersion, 'Cargo.toml version mismatch');
assert(packageJson.license === 'AGPL-3.0-only', 'npm license mismatch');
assert(cargoToml.includes('license = "AGPL-3.0-only"'), 'Cargo license mismatch');
assert(read('LICENSE').trimStart().startsWith('GNU AFFERO GENERAL PUBLIC LICENSE'), 'LICENSE is not AGPLv3');
assert(read('NOTICE').includes('Kid Climber — an open-source climbing-frame design project by Kid Climber contributors.'), 'NOTICE brand statement missing');
assert(read('.node-version').trim() === '24', 'Node.js toolchain is not pinned to 24');
assert(read('rust-toolchain.toml').includes('channel = "1.94.1"'), 'Rust toolchain mismatch');
assert(goVersion === '1.26.3', 'Go toolchain mismatch');
assert(read('frontend/components/ui/HelpModal.tsx').includes('version: __APP_VERSION__'), 'About version must come from build metadata');

const npmrcLines = read('frontend/.npmrc')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('#'));
assert(
  npmrcLines.length === 1 && npmrcLines[0] === 'registry=https://registry.npmjs.org/',
  'frontend/.npmrc must use only the official npm registry',
);

for (const [packagePath, packageEntry] of Object.entries(packageLock.packages)) {
  if (!packageEntry.resolved) continue;
  const resolved = new URL(packageEntry.resolved);
  assert(
    resolved.protocol === 'https:' && resolved.hostname === 'registry.npmjs.org',
    `non-official npm source in package-lock.json at ${packagePath}`,
  );
}

for (const source of cargoLock.matchAll(/^source = "([^"]+)"$/gm)) {
  assert(
    source[1] === 'registry+https://github.com/rust-lang/crates.io-index',
    `non-official Cargo source: ${source[1]}`,
  );
}

for (const workflow of ['.github/workflows/ci.yml', '.github/workflows/release.yml']) {
  const content = read(workflow);
  assert(content.includes('NPM_CONFIG_REGISTRY: https://registry.npmjs.org/'), `${workflow} npm registry mismatch`);
  assert(content.includes('GOPROXY: https://proxy.golang.org,direct'), `${workflow} Go proxy mismatch`);
  assert(content.includes('CARGO_REGISTRIES_CRATES_IO_PROTOCOL: sparse'), `${workflow} Cargo registry protocol mismatch`);
}

console.log(`Release metadata valid for Kid Climber ${expectedVersion}.`);
console.log(`Validated ${Object.keys(packageLock.packages).length} npm package entries and official build sources.`);
