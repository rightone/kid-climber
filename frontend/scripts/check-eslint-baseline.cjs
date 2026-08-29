const fs = require('node:fs');
const path = require('node:path');
const { ESLint } = require('eslint');

const projectRoot = path.resolve(__dirname, '..');
const baseline = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'eslint-baseline.json'), 'utf8'),
);

async function main() {
  const eslint = new ESLint({ cwd: projectRoot });
  const results = await eslint.lintFiles(['.']);
  const summary = {
    generatedAtUtc: new Date().toISOString(),
    errors: results.reduce((total, result) => total + result.errorCount, 0),
    warnings: results.reduce((total, result) => total + result.warningCount, 0),
    baseline,
    filesWithIssues: results
      .filter(result => result.errorCount > 0 || result.warningCount > 0)
      .map(result => ({
        file: path.relative(projectRoot, result.filePath).replaceAll('\\', '/'),
        errors: result.errorCount,
        warnings: result.warningCount,
      })),
  };

  fs.writeFileSync(
    path.join(projectRoot, 'eslint-report.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  console.log(`ESLint: ${summary.errors} errors / ${summary.warnings} warnings`);
  console.log(`Baseline: ${baseline.errors} errors / ${baseline.warnings} warnings`);

  if (summary.errors > baseline.errors || summary.warnings > baseline.warnings) {
    throw new Error('ESLint issue count exceeds the approved public baseline.');
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
