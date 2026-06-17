const { spawnSync } = require('node:child_process');

const forwardedArgs = process.argv.slice(2);
const uvArgs = ['publish'];
const ignoredFlagsWithValues = new Set(['--otp', '--registry', '--tag', '--access']);

for (let i = 0; i < forwardedArgs.length; i += 1) {
  const arg = forwardedArgs[i];

  if (arg === '--yes' || arg === '--first-release' || arg === '--firstRelease') {
    continue;
  }

  if (arg === '--dryRun' || arg === '--dry-run') {
    uvArgs.push('--dry-run');
    continue;
  }

  if (arg.startsWith('--dryRun=')) {
    if (arg.slice('--dryRun='.length) !== 'false') {
      uvArgs.push('--dry-run');
    }
    continue;
  }

  if (arg.startsWith('--dry-run=')) {
    if (arg.slice('--dry-run='.length) !== 'false') {
      uvArgs.push('--dry-run');
    }
    continue;
  }

  if (ignoredFlagsWithValues.has(arg)) {
    i += 1;
    continue;
  }

  let isIgnoredEqualsFlag = false;
  for (const ignoredFlag of ignoredFlagsWithValues) {
    if (arg.startsWith(`${ignoredFlag}=`)) {
      isIgnoredEqualsFlag = true;
      break;
    }
  }

  if (isIgnoredEqualsFlag) {
    continue;
  }

  uvArgs.push(arg);
}

const publishResult = spawnSync('uv', [...uvArgs, 'dist/*'], {
  cwd: 'packages/governance/host-dbt',
  env: process.env,
  shell: true,
  stdio: 'inherit',
});

if (publishResult.status !== 0) {
  process.exit(publishResult.status ?? 1);
}
