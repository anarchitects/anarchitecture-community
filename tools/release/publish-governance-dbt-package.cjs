const fs = require('node:fs');
const path = require('node:path');

const distDir = path.join(
  process.cwd(),
  'packages',
  'governance',
  'dbt-package',
  'dist',
);

if (!fs.existsSync(distDir)) {
  console.error(
    `Expected packed dbt package artifact at ${distDir}. Run the pack target before publishing.`,
  );
  process.exit(1);
}

const forwardedArgs = process.argv.slice(2);
const isDryRun =
  forwardedArgs.includes('--dryRun') || forwardedArgs.includes('--dry-run');

console.log(
  'governance-dbt-package distributes through Git tags and GitHub releases only.',
);
console.log(`Verified packed artifact: ${distDir}`);

if (isDryRun) {
  console.log('Dry run requested; no external publish step was performed.');
}
