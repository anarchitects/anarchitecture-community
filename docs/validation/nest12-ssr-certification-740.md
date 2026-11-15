# Nest 12 Fastify SSR certification — #740

Status: **local review; hosted evidence and Johan's acceptance pending**.
Reviewed 15 November 2026. Accountable owner: Johan, SSR capability owner.
This record does not authorize publication, a version/channel change or adoption.

## Architecture and scope

The preflight enumerated and read all 25 Meta ADRs, every status, at
`4f0339d86f0ebfa073173ad307cb67c8d6042bdd`, and all nine Community ADRs at
`9184b75` (merged #739 / PR #756). CONTRIBUTING, OWNERSHIP, the local SDLC and
the Modern Angular repository, SSR/build and testing guides were reviewed.
Accepted Community ADR0005/0006 preserve one SSR package, explicit HTTP-adapter
selection and the Nest presentation boundary. Meta HTTP0008/0009 and the local
native-first amendment leave native Node and Express implementation under #33;
neither blocks this Fastify-only certification. No adapter runtime, public API,
dependency range or workspace Angular version changes here.

Meta0013–0017 and Community0007 require independently versioned, owner-approved
releases with reviewed compatibility and truthful cache evidence. Meta0022's
latest-stable/90-day maintenance policy does not invent a release or end date.
The accepted #737 patched feature baseline remains authoritative. The old Nest 11
floor has an unresolved security condition described below; compatibility alone
does not satisfy it. Proposed ADRs do not override accepted decisions.

## Candidate and reproducible evidence

The companion [evidence JSON](nest12-ssr-certification-740-evidence.json) retains
source commit, dirty working-tree state, SHA256 input manifests, exact cell pins,
archive identity, lock hashes, check results, HTTP observations and audit snapshots.
These are local macOS/arm64 results on Node24.22.3/npm11.19.1. They do not identify
a future PR commit or establish hosted Ubuntu/macOS or remote-restoration results.
The content hashes identify the locally tested implementation; review documents
were written afterwards.

Feature archive SHA256:
`b58acbf78d8c282f7808e5026d5034c855fa84bd2824f4de0fcfebe3304c0e62`.
Its manifest still says `0.3.2`: these are development bytes, **not** a replacement
for published `0.3.2` and not an authorized release candidate version.

| Required feature cell | Exact environment                                                                            | Local result                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| N12-current           | Nest12.5.0; Angular22.2.6; SSR22.2.7; Fastify5.12.8/static10.1.11; TypeScript6.0.3; Nx24.0.6 | 15 checks; CJS and ESM                                                                |
| N12-split             | Same runtime/tool versions, Angular build22.2.7; Playwright1.64.0                            | Six checks; real Angular ESM server and CJS Nest host, browser hydration/event replay |

Both runtime-only audit snapshots report zero advisories. This is a dated registry
observation, not a guarantee of absence of vulnerabilities. The historical
Angular22.1 reference is not an active feature cell. The complete lock and installed
dependency tree are retained for each installation; no forced peer resolution,
workspace aliases or manifest rewriting makes the candidate install.

The final-archive release-gate rehearsal uses `--archive` plus the mandatory
`--archive-sha256` against these same bytes, runs both active cells and records
40 evidence files. An explicit `--output-directory` must not already exist.
It does not repack, tag or publish the tested archive. Root release readiness now
runs the locked feature matrix; final consumer verification repeats certification
after the last build/pack so the release record binds the actual retained bytes.
Tests reject changed/repacked bytes, failed or missing cells, omitted hydration
and failed security checks.

## Behavior and lifecycle coverage

| Boundary              | Evidence and limits                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assets and routing    | Existing packed-consumer conformance covers public assets, missing assets, canonical paths, encoded separators/dot segments, repeated slashes, traversal, case aliases, API-prefix bypass, GET/HEAD and null-to-not-found delegation. Local macOS verifies a case-insensitive volume. Assets must be trusted public build output.                                         |
| Hosts and proxies     | Allowed hosts and spoofed forwarded headers with default, explicitly trusted and untrusted proxy configurations. The host owns its proxy trust policy.                                                                                                                                                                                                                    |
| Response bridge       | Both exports are loaded from the isolated package; actual loopback HTTP proves status, redirects, headers, multiple cookies, empty HEAD delivery and null/404.                                                                                                                                                                                                            |
| Middleware            | On the active Nest12 cell, a real Nest controller with path-scoped middleware denies both origin-form and absolute-form HTTP request targets. This supplements inject tests, which do not establish that raw request-line behavior.                                                                                                                                       |
| Response buffering    | A gated two-chunk Web Response emits nothing before completion. A 4 MiB response reaches a temporarily paused client intact. All renderer chunks are read before response headers arrive: this proves buffering, **not** renderer backpressure, incremental streaming or bounded memory for arbitrary bodies. HEAD delivery is empty but the bridge still reads the body. |
| Disconnect            | After the server observes the client connection close, the renderer's Web Request signal remains un-aborted; rendering can finish after disconnection. Cancellation propagation is **not supported** by this bridge.                                                                                                                                                      |
| Errors and isolation  | Renderer rejection and Web Response body-read errors return generic 500 responses without the sentinel message/partial body; subsequent requests work. Eight overlapping requests keep their context and headers separate.                                                                                                                                                |
| Application lifecycle | Test-owned clients/sockets are closed, `app.close()` finishes and the listener refuses subsequent connections. The harness deadline bounds failures. This is not a promise of graceful draining of unbounded application work.                                                                                                                                            |
| Real Angular          | The split fixture checks built output boundaries, SSR/API/assets/HEAD/redirects and an actual browser retaining the SSR node through hydration, replaying a pre-bootstrap click and handling a post-hydration click without browser errors.                                                                                                                               |
| Harness lifecycle     | Twelve existing lifecycle tests cover startup/assertion failure, signal exit, hang/deadline, descendants and termination; nine locked-runner tests cover binding, environment isolation and child cleanup.                                                                                                                                                                |

The public README now states buffering and disconnect limitations. Tests deliberately
describe existing behavior rather than advertising a streaming/cancellation feature.
Changing those semantics belongs in reviewed adapter work; Johan must accept these
limits for this certification.

## Nest 11 maintenance: regression is not security certification

The preserved maintenance archive has SHA256
`215d6ef9516a01f78c659f72b3d2925f343bffb1bfac27b2f0302790fe4b748f`.
All four frozen cells pass 59 compatibility checks against that separate archive;
the Nest12 manifest is never widened to install it. New HTTP bridge observations
also run in both module formats. Nest12-only middleware certification is explicitly
not claimed for these historical cells.

Fresh runtime audit supplements of those exact bound locks show:

| Historical cell   | Compatibility checks | Affected package records       |
| ----------------- | -------------------- | ------------------------------ |
| N11-A21-min-tool  | 14                   | Seven: five high, two moderate |
| N11-A21-next-tool | 14                   | Seven: five high, two moderate |
| N11-A22           | 17                   | Three: two high, one moderate  |
| N11-patched-floor | 14                   | Four: three high, one moderate |

The floor's adapter11.1.29 is itself affected by
[GHSA-9c5c-9qcx-q35q](https://github.com/advisories/GHSA-9c5c-9qcx-q35q), an
absolute-form request-target bypass of path-scoped middleware. A Fastify5.12.8
override does not repair Nest's adapter code. Upstream fixes are in Nest11.2.4
and 12.0.2 (with subsequent patch upgrades recommended); the active Nest12.5.0
cell is outside that affected range. Historical Angular advisories remain too.

**The #737 old-floor retention condition is not established by these results.**
No maintenance release should use this record as security acceptance. Johan must
review a patched maintenance consumer strategy and, if necessary, an explicit
floor/version-line amendment under #737's contingency. No peer contract is changed
silently here. The remote branch `maintenance/nest-angular-ssr-0.3` was absent in
the read-only inventory; source protection and executable maintenance releases
remain #748/#741 work. #722 stays paused. These findings do not require an
additional HTTP adapter before a Fastify-only Nest12 release can be assessed.

## CI, artifacts and cache/DTE exception

The existing affected selection and required aggregate retain their job set.
The existing two consumer runners execute N12-current on Ubuntu/macOS; the existing
Ubuntu compatibility slot executes N12-split. Node is pinned to24.22.3 in those
jobs and release preparation. Chromium is installed explicitly for the split
cell. The workspace's existing split check remains; no runners/workers are added.

Both jobs upload `dist/validation/nest12-ssr-740/` on success or failure, require
an artifact and retain it for90 days. It contains the candidate archive, per-cell
bound locks, install/tree/audit/build/probe logs, HTTP/hydration results and aggregate
report. Release preparation retains final-byte certification under the release
payload's evidence directory and binds each evidence file by hash. Johan's durable
archive remains encrypted USB **Anarchitects**, with a second copy on
**Asustor Lockerstor AS6604T**, before hosted retention expires.

`validate-locked-consumers`, lifecycle checks, browser installation and the root
release gate are uncached. Source/fixture/lock inputs, CI workflow, Node/platform/
architecture and browser-path configuration are modeled; actual browser identity
is recorded. Unit, build, declaration and deterministic runner tests may use the
existing local cache. Fresh installs, registry audits, loopback HTTP and browser
processes remain outside DTE. **No remote-cache restoration or distributed
execution proof is claimed for this certification.** This preserves the existing
SSR execution exception rather than adopting a new workspace-wide policy.
Exception owner: Johan. Revisit at #741 readiness and before any runner/cache/DTE
change; do not treat #715 implementation or documented exceptions as owner acceptance.

Local Nx package test/typecheck/lint, CI-selection/graph/aggregate and release-policy
tests pass. The release-policy suite includes eight new final-archive gate tests.
Formatting and diff checks are part of the local review. No hosted execution or
monitoring was started for #740.

## Remaining acceptance

1. Obtain permission for the concrete push/PR and normal hosted CI; inspect hosted
   results only with the required monitoring authorization. Retain exact SHA,
   archive and per-platform evidence, including the macOS case-insensitive check.
2. Johan accepts the Fastify feature certification and buffering/disconnect limits.
   Historical maintenance compatibility must not be accepted as security readiness;
   resolve the old-floor contingency before a maintenance release.
3. #741 assesses technical readiness with #748's release controls; #722/#742 retain
   separate activation/publication authority. No downstream adoption is inferred.

#740 remains open and blocked on hosted evidence/owner acceptance. Merge alone
does not complete those outcomes.
