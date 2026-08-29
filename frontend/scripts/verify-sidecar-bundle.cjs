const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const target = process.env.SIDECAR_TARGET;
if (!target) {
  throw new Error('SIDECAR_TARGET is required');
}
const frontendRoot = path.resolve(__dirname, '..');
const extension = target.includes('windows') ? '.exe' : '';
const sourcePath = path.join(
  frontendRoot,
  'src-tauri',
  'binaries',
  `kid-climber-server-${target}${extension}`
);
const bundleDirectory = path.join(
  frontendRoot,
  'src-tauri',
  'target',
  target,
  'release',
  'bundle'
);
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'kid-climber-bundle-'));

const sha256 = filePath => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const listFiles = directory => {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
};

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'ignore' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} could not inspect the generated installer`);
  }
};

if (!fs.existsSync(sourcePath) || fs.statSync(sourcePath).size === 0) {
  throw new Error(`Expected non-empty sidecar was not found: ${path.basename(sourcePath)}`);
}

const bundleFiles = listFiles(bundleDirectory)
  .filter(filePath => fs.statSync(filePath).size > 0)
  .sort();
if (bundleFiles.length === 0) {
  throw new Error('Tauri did not produce any non-empty bundle files');
}

let installerPath;
let extractedDirectory = path.join(temporaryDirectory, 'extracted');
let mountedDmg = false;
try {
  if (target.includes('windows')) {
    installerPath = bundleFiles.find(filePath => filePath.toLowerCase().endsWith('.exe'));
    if (!installerPath) throw new Error('Windows NSIS installer was not produced');
    fs.mkdirSync(extractedDirectory, { recursive: true });
    run('7z', ['x', '-y', `-o${extractedDirectory}`, installerPath]);
  } else if (target.includes('linux')) {
    installerPath = bundleFiles.find(filePath => filePath.endsWith('.deb'));
    if (!installerPath) throw new Error('Linux DEB installer was not produced');
    fs.mkdirSync(extractedDirectory, { recursive: true });
    run('dpkg-deb', ['--extract', installerPath, extractedDirectory]);
  } else if (target.includes('apple-darwin')) {
    installerPath = bundleFiles.find(filePath => filePath.endsWith('.dmg'));
    if (!installerPath) throw new Error('macOS DMG installer was not produced');
    fs.mkdirSync(extractedDirectory, { recursive: true });
    run('hdiutil', ['attach', '-nobrowse', '-readonly', '-mountpoint', extractedDirectory, installerPath]);
    mountedDmg = true;
  } else {
    throw new Error(`Unsupported bundle verification target: ${target}`);
  }

  const bundledName = `kid-climber-server${extension}`;
  const bundledPath = listFiles(extractedDirectory).find(filePath => (
    path.basename(filePath) === bundledName && fs.statSync(filePath).size > 0
  ));
  if (!bundledPath) {
    throw new Error('Extracted installer does not contain the embedded sidecar');
  }

  const sourceSha256 = sha256(sourcePath);
  const bundledSha256 = sha256(bundledPath);
  if (sourceSha256 !== bundledSha256) {
    throw new Error('Embedded sidecar does not match the verified sidecar input');
  }

  const reportDirectory = path.join(frontendRoot, 'build', 'release-validation');
  fs.mkdirSync(reportDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(reportDirectory, `${target}.json`),
    `${JSON.stringify({
      target,
      installer: path.basename(installerPath),
      sourceSha256,
      bundledSha256,
      bundleFiles: bundleFiles.map(filePath => (
        path.relative(bundleDirectory, filePath).replaceAll('\\', '/')
      )),
    }, null, 2)}\n`
  );

  console.log(`Verified embedded sidecar inside installer for ${target}`);
} finally {
  if (mountedDmg) {
    spawnSync('hdiutil', ['detach', extractedDirectory], { stdio: 'ignore' });
  }
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
