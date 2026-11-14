# Nest 12 Angular SSR compatibility audit — #736

Date: 14 November 2026. Owner: Johan, SSR capability owner.
Status: audit and proposed proof matrix accepted by Johan on 14 November 2026;
the matrix is **not certified runtime support**.
Parent: [#578](https://github.com/anarchitects/anarchitecture-community/issues/578).

## Finding and recommendation

Stable Nest **12.5.0** is available. Begin compatibility proof with coherent
`@nestjs/common`, `core` and `platform-fastify` 12.5.0, Fastify **5.12.8**,
`@fastify/static` **10.1.11**, Node **24.22.3** and TypeScript **6.0.3**.
Use separately pinned Angular 22.1 and 22.2 consumers below. This selects audit
targets, not a new package version, peer range, default adapter or release date.

Published `@anarchitects/nest-angular-ssr@0.3.2` still supports Nest 11. Its
Nest peers reject major 12. A peer edit alone cannot establish compatibility.
Keep its patch-only maintenance path under #737; do not overwrite its artifact.

The highest-priority proof gaps are ESM/CJS loading and declarations, reproducible
consumer locks, module lifecycle/route ordering, legacy Angular private APIs,
real browser hydration and nested dependency security. Native Node and Express
are outside this Fastify audit. #33 retains adapter-neutrality/Express ownership.

## Evidence and limits

Reviewed Community `e968ec02301633dfc42ca924edb43ee2fa6f4529` and Meta
`b2cc857bef3ecc4180ca8180db015ba5537bc497`; the Meta checkout matched remote main.
The [machine-readable inventory](nest12-ssr-audit-736-evidence.json) retains
registry metadata, available publication timestamps, artifact identities,
selected workspace lock resolutions and scoped advisory responses.

Executed: read-only npm metadata queries, official documentation/source checks,
GitHub advisory queries, lockfile inspection and resolved Nx target inspection
with Nx Cloud and DTE disabled. No dependencies were installed, tarballs executed,
fixtures run, hosted checks dispatched or releases prepared. Historical results
in #584/#590 and the existing validation notes remain historical evidence.
This audit does not claim a passing Nest 12 build, clean full dependency tree,
hosted-platform result or consumer adoption.

## Architecture preflight

Enumerated and read all **9 Community ADRs** in `docs/adr/` and all **24 Meta
records** in `adr/`, including duplicate numeric identifiers and `ADR-0001.md`.
No additional ADR directory was found in the repository file inventory/documented
locations. The inventory includes all statuses, not only SSR decisions.

- Community 0001–0008 and `modern-angular-22-signal-forms.md` are accepted.
- Meta's cooperative-enrichment 0001 and governance 0005/0006/0007 remain
  proposed. The other enumerated records are accepted; historical implementation
  snapshots inside them are not fresh operational evidence.
- Community 0005/0006 and Meta HTTP 0008/0009/0010/0011 require demonstrated
  adapter/runtime compatibility, preserved security, Nest 11 patch maintenance
  and no mandatory AuthN/AuthZ/Mail/Zod dependencies in SSR.
- Community 0004/0007, Modern Angular and Meta 0013–0021 require accurate public
  documentation, independent zero-major versioning, human dependency review,
  evidence-based Nx execution, owner acceptance and separate release/adoption.
- Read CONTRIBUTING, OWNERSHIP, the local SDLC, Modern Angular README,
  repository application, architecture, SSR/builds, testing/migration and
  validation guides. Meta's Nest AI/MCP guide remains proposed guidance.

No accepted architecture conflict was found. Existing fixture and documentation
gaps below are implementation/evidence gaps, not permission to override policy.
The local Angular guide's dated five-ADR inventory is historical; this review
used the actual nine-file inventory. Re-run preflight if implementation scope changes.

## Exact upstream inventory

Sources are public npm metadata, with exact versions/integrities preserved in
the evidence JSON. `latest`/`legacy` are observations, not fixture inputs.

| Component                              | Observed version   | Relevant constraint                                                                                         |
| -------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------- |
| Nest common/core/platform-fastify      | 12.5.0             | Coherent major-12 peers; ESM packages. Core declares Node >=20, but this is not the whole runtime floor.    |
| Nest maintenance core/platform-fastify | 11.2.10 (`legacy`) | Coherent major-11 peers; adapter also pins Fastify 5.12.8.                                                  |
| Fastify                                | 5.12.8             | Exact dependency of the 12.5.0 adapter; do not substitute top-level version evidence for nested resolution. |
| Static plugin                          | 10.1.11            | Satisfies adapter peer ^10.1.10; depends on send ^4.2.0, plugin ^6 and glob ^14.                            |
| Angular framework/compiler             | 22.2.6             | Keep framework packages coherent; core/compiler-cli require Node ^22.22.3, ^24.15.0 or >=26.                |
| Angular SSR/build                      | 22.2.7             | A distinct release train from framework patch 22.2.6; build expects SSR ^22.2.7.                            |
| TypeScript                             | 6.0.3 selected     | Angular compiler-cli requires >=6.0 <6.1. Registry latest 7.0.2 is excluded.                                |
| Nx / @nx/angular                       | 24.0.6 current     | Angular 22.2 tooling candidate; no workspace-wide upgrade is proposed.                                      |
| Node                                   | 24.22.3            | Official non-prerelease and actual local audit runtime; within Angular's Node 24 range.                     |
| Published SSR                          | 0.3.2              | Nest common/core ^11, platform-fastify ^11.1.29, Fastify ^5, static ^10.1.7; Angular 21/22.                 |

Nest 12's CommonJS interoperability uses Node `require(esm)`; custom bundlers and
test runners need explicit proof. The documented runtime floor is 20.19 or 22.12,
but 12.5.0's `file-type@22.3.0` dependency requires Node >=22 and Angular imposes
a higher floor. Node 24.22.3 avoids those lower-floor ambiguities. The migration
guide also identifies lifecycle ordering and HTTP error mapping changes relevant
to the adapter. CJS application conversion to ESM is optional.
[Nest migration guide](https://docs.nestjs.com/migration-guide).

The registry metadata for **12.0.0** core and platform-fastify still declares
major-11 Nest peers, unlike 12.5.0. Do not advertise `^12.0.0`, force an install,
or use `--legacy-peer-deps` to hide that discrepancy. #737 must select a tested
floor; this audit proposes 12.5.0 as the first proof target, not the earliest
possible working Nest 12 release.

Angular 22 uses TypeScript 6.0.x. Nx's current matrix places Angular 22.0 at
Nx >=23.1, 22.1 at >=23.2, and 22.2 at >=24. The existing 22.1.4/Nx 23.1.2
fixture does not establish officially supported Angular builder integration:
it invokes a plain TypeScript build through Nx. Keep that historical result
distinct from the proposed supported split build.
[Angular compatibility](https://angular.dev/reference/versions),
[Nx matrix](https://nx.dev/docs/kb/angular-nx-version-matrix).

Node 22/26, Angular 22.0 and other Nest 12 minors are excluded from the initial
proof scope. Broader public ranges require their own boundary evidence before
publication; selecting a supported Node 24 runtime does not certify all Node 24
patches. [Node release](https://github.com/nodejs/node/releases/tag/v24.22.3).

## Current implementation and fixture findings

| Boundary                 | Existing behavior/evidence                                                                                                                                                                   | Required proof and owner                                                                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public package           | Vite emits `index.js` and `index.cjs`; both export conditions point to one `index.d.ts`. Nest and Angular imports are external.                                                              | #738/#739: genuine import/require plus strict NodeNext declaration consumers; `skipLibCheck: true` and legacy node resolution are insufficient proof.                                                                 |
| Module facade            | `forRoot`/`forRootAsync` create a factory provider; `OnApplicationBootstrap` obtains `HttpAdapterHost`/`ApplicationConfig`, caches one integration promise and registers routes.             | #739/#740: synchronous/asynchronous options, disabled path, repeated bootstrap, failure and route-order behavior on Nest 12. Core v12.5.0 still exports ApplicationConfig; export presence is not DI/lifecycle proof. |
| Explicit/advanced APIs   | `bootstrapNestAngularSsr`, integration and route registration operate on the actual Fastify adapter; unsupported adapters throw.                                                             | #738–#740: packed explicit bootstrap and advanced context/renderer paths, preserving public signatures.                                                                                                               |
| HTTP/security            | GET/HEAD root and wildcard routes, API bypass including misses, canonical asset checks, allowed hosts, trusted-proxy-derived URL, redirects, distinct Set-Cookie and null fallback.          | #740: reuse installed-consumer conformance and add Nest 12 lifecycle/error/request-isolation cases.                                                                                                                   |
| Response delivery        | Fastify writer consumes `response.arrayBuffer()` before `reply.send`. It is buffered, not a streaming/backpressure implementation.                                                           | #739/#740 preserve/document the actual baseline and exercise abort/error behavior. Any new streaming implementation needs explicit scope coordination with #33; do not invent existing parity.                        |
| Angular build output     | Structural engine contract, dynamic import of server bundle, separate browser assets; default runtime import avoids CJS bundler rewriting.                                                   | #738/#740: real server output and CJS Nest host, no second Angular runtime/compiler in the host bundle.                                                                                                               |
| Legacy Angular bootstrap | Uses private `ɵ` manifest, route-extraction and server-app functions, with global reset.                                                                                                     | #738/#740: pin Angular minors; check private API availability and cross-request/lifecycle isolation. Do not silently remove the published path or claim multi-app isolation.                                          |
| Direct consumers         | CJS and ESM apps, real HTTP attempt helper plus installed-package security suite. Installs suppress lock creation.                                                                           | #738: retain tarball identity, generate/review locks once and use frozen installs; record every resolved Nest/Fastify/static copy.                                                                                    |
| Compatibility matrix     | Three cells: Angular21.2.0/TS5.9.3 with Nx22.6.0 or 23.1.2; Angular22.1.4/TS6.0.3 with Nx23.1.2. Runner forces Nest11.1.29, removes Fastify override, copies only CJS, checks Node major 24. | #738: parameterize the Nest family and module mode, separate framework/SSR/build versions, correct Nx support claims and pin Node patch. Preserve old results as legacy evidence.                                     |
| Security helper          | Asserts exact manifest strings static ^10.1.7 and Nest adapter ^11.1.29. Uses Fastify injection with synthetic renderer.                                                                     | #738/#740: make expected manifest contracts cell-specific while retaining assertions; do not delete security checks to admit Nest 12.                                                                                 |
| Split fixture            | Angular22.1.4/SSR+build22.1.6, Nx23.1.2, CJS webpack host, Fastify5.12.7 override, fixed port3320, SIGTERM without awaited process-group cleanup.                                            | #738: reuse #590's robust lifecycle approach, isolate ports, freeze locks and revalidate supported builder pairing. #590 fixed the direct attempt helper; do not claim it already covers this separate runner.        |
| Hydration                | Split app config enables hydration/replay; runner checks HTTP content/assets, not browser hydration or replay.                                                                               | #738/#740: real browser load, hydration errors as failures, interaction/replay and two-request isolation; use an explicit browser revision.                                                                           |

Local references: [module](../../packages/nest/angular-ssr/src/lib/nest/nest-angular-ssr-module.ts),
[integration](../../packages/nest/angular-ssr/src/lib/nest/nest-angular-ssr-integration.ts),
[routing](../../packages/nest/angular-ssr/src/lib/nest/nest-angular-ssr-routing.ts),
[legacy registration](../../packages/nest/angular-ssr/src/lib/core/angular-ssr-registration-runtime.ts),
[matrix runner](../../tools/fixtures/validate-nest-angular-ssr-matrix.mjs),
[split runner](../../tools/fixtures/validate-nest-angular-ssr-split.mjs),
[security helper](../../tools/fixtures/nest-angular-ssr-security-conformance.mjs).
Upstream export inspection: [Nest core v12.5.0](https://github.com/nestjs/nest/blob/v12.5.0/packages/core/index.ts).

## Dependency and security disposition

Workspace `yarn.lock` resolves Nest common/core 11.1.17, adapter11.1.29 with
nested Fastify5.11.0, static10.1.7/send4.1.0, Angular22.1.4/SSR22.1.6,
Nx23.2.1 and TypeScript6.0.3. Other Fastify5.12.1/5.8.4 entries also exist;
their presence is not proof they are used by this package. The minimum matrix
intentionally permits the adapter's nested 5.11.0; a top-level 5.12.7 does
not repair that nested copy after the override is removed.

The live GitHub query returns **seven advisories affecting Fastify5.11.0**:
four high-severity entries patched in 5.12.2, two medium entries patched in
5.12.1 and one medium entry patched in 5.12.5. For SSR, the malformed-URL
not-found bypass and proxy-spoofing cases are particularly relevant:
[GHSA-p68q-wchp-6fh7](https://github.com/advisories/GHSA-p68q-wchp-6fh7),
[GHSA-3m5p-2c4r-xxw2](https://github.com/advisories/GHSA-3m5p-2c4r-xxw2).
The full IDs/ranges are in the evidence JSON. This corroborates the existing
[security note's compatibility-versus-security distinction](nest-angular-ssr-security.md).

Queries returned no matches for the exact audited Nest12.5.0 family,
Fastify5.12.7/5.12.8, static10.1.7/10.1.11, send4.1.0/4.2.0,
find-my-way9.7.0/9.10.0 or file-type22.3.0. That is a dated, scoped advisory
lookup, **not** a full installed-tree audit or security certification.
Unresolved caret dependencies must be locked and audited in #738/#740.

Use 5.12.8 for the new candidate and verify nested resolution. For Nest 11,
#737 must distinguish a historical minimum compatibility reproduction from a
security-current maintenance target (coherent 11.2.10 with Fastify5.12.8 is the
candidate). Do not weaken existing safeguards or treat the old minimum cell as a
deployable security baseline. No dependency remediation was performed here.

## Proposed bounded proof matrix

All rows use exact Node **24.22.3**, Fastify **5.12.8**, static **10.1.11**,
RxJS **7.8.2** and reflect-metadata **0.2.2**, subject to frozen-resolution review.
Every row installs the packed artifact appropriate to its release line.
These are proposed future checks, not executed or accepted results.

| Cell              | Nest family | Angular framework / SSR+build | TS    | Nx tooling | Modes and purpose                                                                                      |
| ----------------- | ----------- | ----------------------------- | ----- | ---------- | ------------------------------------------------------------------------------------------------------ |
| N12-reference     | 12.5.0      | 22.1.4 / 22.1.6               | 6.0.3 | 23.2.1     | Direct CJS and ESM, module/async/explicit APIs; retain the current Angular minor on supported tooling. |
| N12-current       | 12.5.0      | 22.2.6 / 22.2.7               | 6.0.3 | 24.0.6     | Direct CJS and ESM plus strict public declarations.                                                    |
| N12-split         | 12.5.0      | 22.2.6 / 22.2.7               | 6.0.3 | 24.0.6     | Real ESM Angular application output, CJS webpack Nest host and browser hydration/replay.               |
| N11-A21-min-tool  | 11.2.10     | 21.2.0 / 21.2.0               | 5.9.3 | 22.6.0     | Retained Angular21/tooling baseline with security-current Nest; CJS/ESM direct consumers.              |
| N11-A21-next-tool | 11.2.10     | 21.2.0 / 21.2.0               | 5.9.3 | 23.1.2     | Preserve the second existing Angular21 Nx cell.                                                        |
| N11-A22           | 11.2.10     | 22.1.4 / 22.1.6               | 6.0.3 | 23.2.1     | Retained Angular22 maintenance behavior and split-host regression.                                     |

Do not replace the Nest11.1.29 historical minimum record with a claim it ran
11.2.10. If the owner retains the old floor, #738 must add a distinct bounded
compatibility reproduction with an explicit patched nested-Fastify strategy;
otherwise #737 must approve a documented maintenance-floor change. No support
floor changes in this audit.

The current matrix has one `angular` field but framework and SSR/build patches
differ. #738 must model them independently and retain complete locks, tarball
digests and resolved trees. No floating `latest`, peer-bypass install, workspace
alias or source fallback may count as clean-consumer proof. These six named cells
are bounded scenarios, not a Cartesian product across every toolchain version.
Nx is fixture tooling, not a new runtime peer of the SSR library.

## Acceptance and handoff

- #737: accept the tested-floor strategy, feature/maintenance separation and
  version routing. Audit targets do not decide the next package version.
- #738: implement frozen consumers, split framework/tooling pins, strict types,
  process cleanup and browser proof. Preserve the historical baseline separately.
- #739: make only evidence-required compatibility changes; keep the published
  public APIs and maintenance path or obtain an explicit versioned migration.
- #740: prove lifecycle, HTTP/security, isolation, error/abort behavior and
  applicable platform checks; audit the actual installed dependency closure.
- #741: ship accurate consumer docs and accepted technical readiness.
- #742: publication remains separately gated by paused #722 and exact owner
  release authorization. App adoption stays in its owning repositories.

Johan accepted this audit and proof matrix on 14 November 2026 and explicitly
authorized committing, pushing and opening a PR that may close #736 on merge.
The audit remains In Review until that delivery is merged; downstream planning
must then reconcile its resolved prerequisite. Acceptance does not establish
runtime compatibility or authorize release activation, dependency changes,
additional hosted experiments or publication.
