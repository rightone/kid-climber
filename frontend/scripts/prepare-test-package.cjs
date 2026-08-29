const fs = require('node:fs');
const path = require('node:path');

const outDir = path.join(__dirname, '..', '.test-dist');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2)
);

