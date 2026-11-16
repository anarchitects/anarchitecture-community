// Shared by unprivileged preparation and the built-in-only main controller.
// Changes to this allowlist require the SSR owner's review, not a request input.
export const SSR_PROJECT = 'nest-angular-ssr';
export const SSR_NAME = '@anarchitects/nest-angular-ssr';
export const MAINTENANCE_BRANCH = 'maintenance/nest-angular-ssr-0.3';
export const MAINTENANCE_ANCHOR = '8ff34b9d627d8031321f5ac45b526ec03ed05578';
export const lines = Object.freeze({
  nest11: Object.freeze({
    branch: MAINTENANCE_BRANCH,
    channels: ['nest11'],
    cell: 'nest11',
    allBranches: false,
  }),
  nest12: Object.freeze({
    branch: 'main',
    channels: ['next', 'latest'],
    cell: 'nest12',
    allBranches: true,
  }),
});
const requireLine = (condition, message) => {
  if (!condition) throw new Error(message);
};

export function releaseLine(name) {
  requireLine(Object.hasOwn(lines, name), 'Unknown approved SSR release line');
  return lines[name];
}

export function validateLineScope(name, branch, packages) {
  const line = releaseLine(name);
  requireLine(branch === line.branch, 'Wrong source branch for SSR line');
  requireLine(
    packages.length === 1,
    'SSR line cannot expand unrelated dependent releases',
  );
  const p = packages[0];
  requireLine(
    p.project === SSR_PROJECT && p.name === SSR_NAME && p.channel === 'npm',
    'SSR line is restricted to its exact package',
  );
  requireLine(line.channels.includes(p.distTag), 'Wrong channel for SSR line');
  requireLine(
    Array.isArray(p.dependencies) && p.dependencies.length === 0,
    'SSR line cannot authorize incidental dependency publication',
  );
  return line;
}

export function validateLineRecord(record) {
  const line = validateLineScope(
    record.line,
    record.candidate.branch,
    record.packages,
  );
  const p = record.packages[0];
  requireLine(
    /^0\.\d+\.\d+$/.test(p.version),
    'SSR lines require a reviewed stable 0.x candidate',
  );
  requireLine(
    p.distTag === (record.line === 'nest11' ? 'nest11' : 'next'),
    'Wrong initial SSR publication channel',
  );
  requireLine(
    JSON.stringify(p.channelTargets) ===
      JSON.stringify(
        record.line === 'nest11' ? ['nest11'] : ['next', 'latest'],
      ),
    'Unapproved channel targets',
  );
  requireLine(
    record.evidence?.ci?.head === record.candidate.commit &&
      record.evidence.ci.branch === line.branch,
    'CI does not bind the exact source line',
  );
  requireLine(
    record.evidence.ci.id === record.evidence.ciRunId,
    'CI identity mismatch',
  );
  requireLine(
    /^[a-f0-9]{64}$/.test(record.requestDigest),
    'Missing integrated request digest',
  );
  requireLine(
    record.evidence.sourceProtection?.branch === line.branch,
    'Missing source protection evidence',
  );
  const baseline = p.nxBaseline;
  requireLine(
    baseline?.tag === `${SSR_PROJECT}@${p.nxVersion.currentVersion}` &&
      /^[a-f0-9]{40}$/.test(baseline.commit),
    'Missing verified Nx baseline',
  );
  if (record.line === 'nest11') {
    requireLine(
      record.candidate.anchor === MAINTENANCE_ANCHOR,
      'Wrong maintenance ancestry anchor',
    );
  }
  return line;
}

export function validateSsrManifest(line, manifest, baseline, compatibility) {
  releaseLine(line);
  requireLine(manifest.name === SSR_NAME, 'Wrong SSR source manifest');
  const peers = manifest.peerDependencies ?? {};
  requireLine(
    peers['@nestjs/platform-fastify'] ===
      (line === 'nest11' ? '^11.2.10' : '~12.5.0'),
    'Unreviewed SSR adapter floor',
  );
  if (line === 'nest11') {
    requireLine(
      peers['@nestjs/common'] === '^11.0.0' &&
        peers['@nestjs/core'] === '^11.0.0',
      'Maintenance must retain the Nest 11 contract',
    );
  } else {
    requireLine(
      peers['@nestjs/common'] === '~12.5.0' &&
        peers['@nestjs/core'] === '~12.5.0',
      'Feature source must use the verified Nest 12 line',
    );
  }
  // A changed installation contract must not be disguised as a patch. The
  // accepted floor migration and framework migration both require this gate.
  const sorted = (object) =>
    JSON.stringify(
      Object.entries(object ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    );
  if (
    sorted(peers) !== sorted(baseline.peerDependencies) ||
    sorted(manifest.engines) !== sorted(baseline.engines)
  )
    requireLine(
      compatibility?.minimumBump === 'major',
      'Changed SSR peer/engine contract requires breaking compatibility evidence',
    );
}

export function validateIntegratedRequest(record, request) {
  const p = record.packages[0];
  requireLine(
    request.schema === 1 &&
      request.line === record.line &&
      request.branch === record.candidate.branch &&
      request.baseline === record.baseline &&
      !request.firstRelease &&
      !request.stabilize &&
      JSON.stringify(request.projects) === JSON.stringify([SSR_PROJECT]),
    'Integrated SSR request scope differs',
  );
  requireLine(
    request.channels?.[SSR_PROJECT] === p.distTag &&
      request.versions?.[SSR_PROJECT]?.newVersion === p.version &&
      request.versions[SSR_PROJECT].currentVersion ===
        p.nxVersion.currentVersion &&
      JSON.stringify(request.compatibility?.[SSR_PROJECT]) ===
        JSON.stringify(p.compatibility),
    'Integrated SSR request intent differs',
  );
  if (record.line === 'nest11')
    requireLine(
      request.controllerDigest === record.controller.digest,
      'Integrated request controller differs',
    );
  // Original frozen records remain recoverable. New requests bind the exact Nx
  // entry independently of whether nx.json enables a cumulative changelog file.
  if (request.changelogs !== undefined)
    requireLine(
      request.changelogs?.[p.project]?.version === p.version &&
        typeof request.changelogs[p.project].contents === 'string' &&
        request.changelogs[p.project].contents.trim() &&
        request.changelogs[p.project].contents === p.notes,
      'Integrated Nx changelog differs',
    );
}
