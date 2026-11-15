// Data-only checks are repeated by the credentialed controller. Never execute a
// report, import the archive, or install a consumer in that controller.
export function validateSsrCertification(
  report,
  line,
  archiveHash,
  controllerCommit,
) {
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  check(
    report.status === 'passed' && report.releaseAudit === true,
    'Missing successful release-audited SSR certification',
  );
  check(
    report.archive?.source === 'external-verified-archive' &&
      report.archive.sha256 === archiveHash,
    'SSR certification tested different bytes',
  );
  if (controllerCommit)
    check(
      report.sourceCommit === controllerCommit,
      'SSR harness must come from the preparation controller',
    );
  const expected =
    line === 'nest12'
      ? ['N12-current', 'N12-split']
      : ['N11-A21-min-tool', 'N11-A21-next-tool', 'N11-A22'];
  check(
    ['nest11', 'nest12'].includes(line) &&
      JSON.stringify(report.cells?.map((c) => c.name).sort()) ===
        JSON.stringify(expected),
    'Wrong SSR certification cells',
  );
  for (const cell of report.cells) {
    check(cell.status === 'passed', `Failed SSR cell: ${cell.name}`);
    const names = ['install', 'dependency-tree', 'runtime-audit'];
    if (cell.name !== 'N12-split')
      for (const mode of ['cjs', 'esm'])
        names.push(
          ...[
            'declarations',
            'build',
            'exports-security',
            'module-http',
            'async-http',
            'explicit-http',
          ].map((name) => `${mode}-${name}`),
        );
    if (['N12-split', 'N11-A22'].includes(cell.name))
      names.push(
        'split-build',
        'split-output-boundary',
        'split-http-hydration',
      );
    for (const name of names)
      check(
        cell.checks?.find((c) => c.name === name)?.status === 'passed',
        `Missing SSR certification: ${cell.name}/${name}`,
      );
  }
}
