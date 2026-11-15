# Locked SSR consumers — #738

Implementation review, 15 November 2026 (Europe/Brussels). Owner: Johan, SSR
capability owner. Inputs: the [accepted audit](nest12-ssr-audit-736.md) and
[accepted release-line policy](nest12-ssr-release-lines-737.md), delivered in
#743/#749. This adds fixture infrastructure; package runtime, peers, dependencies,
version, public support claims and release controls are unchanged.

## Architecture preflight

Enumerated/read all nine Community ADRs and all 24 Meta ADRs, including proposed
and historical records, plus CONTRIBUTING, OWNERSHIP, the local SDLC and the
Modern Angular architecture, SSR/build, testing and validation guides. Community
baseline: `b9b89b91125407b4e755ae443bdadab7074b04c1`; Meta baseline:
`b2cc857bef3ecc4180ca8180db015ba5537bc497`. Also reviewed the concurrent native-first
amendment's changes to Meta0009/0010/0014 at `339b809`; that implementation priority
does not require migration of existing Fastify hosts or certify native Node.

- Community0005/0006 and Meta0008–0011 preserve the SSR façade, common renderer,
  Fastify behavior and Nest 11 maintenance. #33 owns additional adapter work;
  this fixture change implements neither Express nor native Node.
- Modern Angular requires real server output, matching hydrated DOM and replay
  proof. Public package boundaries must be checked using the packed artifact.
- Meta0013–0019 and Community0007 preserve independent versioning, owner acceptance,
  human dependency review and separate release authority. #722 remains paused.
- Meta0015 requires honest task inputs, cache exclusions and isolated resources.
  Governance proposals remain proposals. No accepted architectural conflict was
  identified; no runtime compatibility workaround is introduced here.

## Reproduce

Use **Node 24.22.3**, the workspace's Yarn installation and npm (the recorded run
used **11.19.1**). Registry access and a Playwright **1.64.0 Chromium** installation
are required. Install that browser using the matching Playwright version before
running the split cell; a missing browser fails the test, rather than skipping it.
Run from the repository root:

```sh
NX_NO_CLOUD=true NX_CLOUD_DISTRIBUTED_EXECUTION=false NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack yarn nx run nest-angular-ssr:validate-locked-consumers
```

Select an individual cell with `--cell=N11-patched-floor` or any name below. The
Nx target depends on the package build and both infrastructure/lifecycle suites.
**The complete matrix currently exits nonzero:** its three Nest 12 installation
failures are evidence for #739, not accepted support or expected-success tests.
A successful Nest 11 cell does not hide a failed Nest 12 cell.

| Cell              | Nest    | Angular framework / SSR-build | TS / Nx        | Coverage                                     |
| ----------------- | ------- | ----------------------------- | -------------- | -------------------------------------------- |
| N12-reference     | 12.5.0  | 22.1.4 / 22.1.6               | 6.0.3 / 23.2.1 | Direct CJS + ESM                             |
| N12-current       | 12.5.0  | 22.2.6 / 22.2.7               | 6.0.3 / 24.0.6 | Direct CJS + ESM                             |
| N12-split         | 12.5.0  | 22.2.6 / 22.2.7               | 6.0.3 / 24.0.6 | Angular ESM server + CJS Nest, browser       |
| N11-A21-min-tool  | 11.2.10 | 21.2.0 / 21.2.0               | 5.9.3 / 22.6.0 | Direct CJS + ESM                             |
| N11-A21-next-tool | 11.2.10 | 21.2.0 / 21.2.0               | 5.9.3 / 23.1.2 | Direct CJS + ESM                             |
| N11-A22           | 11.2.10 | 22.1.4 / 22.1.6               | 6.0.3 / 23.2.1 | Direct CJS + ESM and split/browser           |
| N11-patched-floor | 11.1.29 | 22.1.4 / 22.1.6               | 6.0.3 / 23.2.1 | Direct CJS + ESM with patched nested Fastify |

All cells pin Fastify **5.12.8**, static **10.1.11**, reflect-metadata **0.2.2** and
RxJS **7.8.2**. The consumer-root `$fastify` override constrains nested copies too;
assertions reject any other Fastify version. This is specifically the patched
11.1.29 consumer proof requested by #737, not proof that the unmodified old
adapter's vulnerable bundled Fastify is deployable.

## Locks and artifact identity

The [matrix](../../tools/fixtures/nest-angular-ssr-locked-matrix.json) and seven
[environment manifests/lockfiles](../../tools/fixtures/nest-angular-ssr-locks)
freeze direct and transitive third-party inputs, including tooling. They contain
no changing local package reference. Validation never refreshes these locks.

Each run packs the actual built package, reads its manifest from the archive,
records SHA256/SHA512, and binds **only that archive's entry and root reference**
into a copy of the environment lock. All third-party entries remain unchanged;
the subject's actual dependency and peer ranges remain unchanged. New undeclared
environment dependencies require a reviewed lock refresh. Strict `npm ci` then
validates the combined graph, without `--force` or `--legacy-peer-deps`. Dependency
install scripts are disabled; the real compilation/runtime/browser checks still
run. A frozen lock mismatch or installation failure fails the cell.

Each consumer lives in a fresh OS temporary directory, outside the repository.
The direct CJS/ESM fixture directories share only their own cell's frozen parent
installation. Source references and ambient Node source conditions/aliases are
removed; installed public resolution paths must remain inside that installation.
The complete installed dependency tree is retained. Strict `.cts` and `.mts`
public API checks use NodeNext with `skipLibCheck: false`; ordinary app compilation
retains its existing settings so declaration and runtime results stay distinct.

Evidence is written to a unique `dist/validation/nest12-ssr-738/<selection>-*/`
directory: archive, input hashes, bound manifests/locks, tool versions, installed
trees, stdout/stderr, per-check results and final status. Copy the retained archive
to `candidate.tgz` beside a retained manifest/lock to reproduce the install using
`npm ci --ignore-scripts`. Keep the whole evidence directory when handing a failure
to #739/#740. Temporary installations are removed after success or failure.

To deliberately refresh a cell's third-party lock, use
`corepack yarn nx run nest-angular-ssr:refresh-consumer-locks --cell=<name>` with the
same local-only environment above. Review the manifest/lock diff; do not refresh
to make a failing support cell green. No package dependency or root Yarn lock is
changed by that operation.

### Angular 22.2.7 tooling exception

Its optional `@oxc-parser/binding-wasm32-wasi@0.156.0` pins emnapi **2.0.0-alpha.6**
but requests wasm-runtime `~1.2.6`. Published wasm-runtime 1.2.6/1.2.7 peers exclude
that alpha, so strict resolution fails even on a platform using native bindings.
The N12-split environment narrowly overrides **only that binding's**
`@napi-rs/wasm-runtime` to **1.2.5**, whose declared peers accept alpha.6. This is a
fixture-tooling exception for review, not a package dependency or peer bypass.
Remove it when an upstream peer-compatible combination is available and revalidate
the cell. Native macOS arm64 Angular 22.2.7 compilation passed separately using
this exact frozen environment; WASM fallback execution is **not** certified.

## Behavioral checks and lifecycle

Direct consumers exercise `forRoot`, `forRootAsync` and explicit
`bootstrapNestAngularSsr` in both CJS and ESM, with actual SSR, assets and API
responses. Separate processes prove public exports and the existing packed
security conformance (GET/HEAD, API misses, null fallback, redirects, multiple
cookies, host/proxy trust, static path normalization and traversal protection).

The existing split fixture builds Angular's real ESM server bundle and its CJS
Nest webpack host. It checks the output boundary, SSR/API/assets/misses, redirects
and HEAD. Chromium holds external JavaScript until it clicks the SSR button,
then verifies that the click is replayed once, the original server DOM node is
retained and a subsequent hydrated click works. Browser errors and hydration
warnings fail the probe. No skip-hydration exception is used.

The shared #590 helper owns server process groups and awaits TERM/KILL cleanup.
Port zero and the child-announced bound port prevent collisions; commands,
startup, HTTP requests, browser actions and shutdown have finite time limits.
The 12 existing lifecycle tests remain, alongside seven new archive/environment,
vulnerable nested-copy, spawn-error, hung-command and interruption tests.

Fresh installation and the aggregate matrix are uncached, with unique evidence
outputs; they are not admitted to DTE by this change. Lock refresh is an explicit
uncached mutation. Infrastructure unit tests are locally cacheable with declared
fixture/toolchain inputs; a source change produced a miss and the identical
subsequent invocation reused the local result. Existing legacy consumer/matrix/split targets and hosted
CI routing are retained; #740 owns certification and CI integration. No hosted CI,
remote cache, DTE, release or publication evidence is claimed.

## Local results and #739 handoff

On 15 November 2026, macOS arm64 / Node 24.22.3 / npm 11.19.1:

- **Four Nest 11 cells pass**, including the patched 11.1.29 floor. Each direct cell
  passes 14 checks; N11-A22 passes 17 including split/browser checks.
- **All three Nest 12 cells fail strict installation** with `ERESOLVE`: the packed
  0.3.2 manifest requires Nest common/core `^11` and platform-fastify `^11.1.29`,
  while these consumers select 12.5.0. Compilation/runtime after that failure are
  unexecuted, not certified or silently skipped as success.
- The infrastructure/lifecycle suites pass **19 tests**. Chromium **156.0.8078.4**
  (Playwright 1.64.0) proves one replayed and one post-hydration click with retained
  SSR DOM. Angular 22.2.7 toolchain-only compilation also passes independently;
  that does not establish Nest 12 SSR integration.

The [machine-readable record](nest12-ssr-consumers-738-evidence.json) retains
input/lock hashes and each check outcome. The full local run is `all-8Rzg1O`; the packed 0.3.2 SHA256 is
`215d6ef9516a01f78c659f72b3d2925f343bffb1bfac27b2f0302790fe4b748f`.
Its source base is the Community commit above plus the #738 working changes;
`result.json` records individual input hashes. Subsequent formatting or fixture
changes require a fresh run when they affect behavior. This is local evidence,
not publication, a full security certification, or an exhaustive support matrix.

#739 must implement the accepted separate-line peer/dependency policy and resolve
any subsequent runtime/export/declaration failures against these same locks.
Do not broaden peers or force-install solely to bypass this first failure.
#740 certifies behavior/security and hosted coverage; #741/#748 govern readiness;
#742/#722 retain publication/activation authority. Johan's acceptance of #738's
fixture implementation remains a separate review gate.
