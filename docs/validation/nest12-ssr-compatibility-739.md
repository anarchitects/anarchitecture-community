# Nest 12 SSR compatibility implementation — #739

Owner: Johan, SSR capability owner. Started 15 November 2026 after accepted
#737 and completed #738 / merged PR #750. Branch:
`feat/nest12-ssr-compatibility-739`, base
`8ff34b9` (merged native-Node-first ADR amendment #747).

## Architecture review and scope

Enumerated and read all 24 Meta ADRs at
`3899558482b615aa46dd5004eae440d62cd2e222` (main at initial review) and all nine
Community ADRs at the base above, including proposed and historical records.
Reviewed CONTRIBUTING, OWNERSHIP, local SDLC, Modern Angular index/repository
application/architecture/SSR/testing guides, accepted #736/#737 evidence, #738
fixtures and the main-branch CI/protection contract. The four Meta governance
proposals remain proposed. No architectural conflict was found.

Community 0004–0007 and Modern Angular, Meta HTTP0008/0009 and 0010–0021 require
one SSR package, preserved public APIs/security, explicit adapter boundaries,
separate Nest 12 feature and Nest 11 patch lines, real packed evidence, truthful
public documentation, human dependency review and independent release authority.
Native Node has priority as the next new adapter under #33; it is not required
for this Fastify-only Nest 12 compatibility change. No optional auth/mail/schema
framework is introduced. No runtime source or public export changed: the existing
implementation passes the real Nest 12 consumer seams without a special branch.

The initial change applies #737's bounded Nest/Fastify/Angular/Node manifest policy,
updates local Nest build/test dependencies and existing fixture inputs, and keeps
the Nx version unchanged. Node 24 supports CJS loading of Nest 12's ESM packages;
actual CJS/ESM consumers prove it rather than assuming it from metadata. See
[Nest's migration guide](https://docs.nestjs.com/migration-guide#esm-packages).

## Separate artifact lines

The working package version remains `0.3.2` until authorized Nx release preparation;
these development bytes must never overwrite the published 0.3.2. The future
commit/PR requires breaking intent (`feat(nest-angular-ssr)!`) and an explicit
Nest 11/Angular 21 exclusion notice. #737's initially 0.4.x feature line and
0.3.x patch-only maintenance policy remain authoritative; no version/tag/channel
was created or moved.

Before changing the manifest, built and packed the unchanged base. Its SHA256
is `215d6ef9516a01f78c659f72b3d2925f343bffb1bfac27b2f0302790fe4b748f`, identical
to #738's reviewed baseline. The current runner can consume that actual archive
with a mandatory hash check, preserving its genuine peers and immutable third-party
locks. It never rewrites the baseline into a dual-major manifest. `--cell=nest11`
and `--cell=nest12` select independent lines; the feature branch defaults to Nest12.
An explicit single cell remains available, including the historical reference;
grouped selectors exclude historical cells. `all` selects active cells across
both lines, which still require their appropriate artifact. Supplying an incompatible
archive is a real install failure, not an expected pass or forced installation.

The baseline source remains available at the base commit. **Before merging the
first breaking implementation**, preserve the then-current reviewed Nest11-compatible
main commit as protected `maintenance/nest-angular-ssr-0.3`, per #737. That remote
branch/protection has not been created by this local work. #748 still owns safe
maintenance release execution; #741 must verify the actual branch and controls.
Do not back-merge the feature manifest/lock into maintenance.

## Local evidence

[Machine-readable evidence](nest12-ssr-compatibility-739-evidence.json) records
the final draft tarball SHA256, exact locked versions, input hashes and individual
results. The initial proof was repeated after the README/runner changes.

Node 24.22.3 / npm 11.19.1 / macOS arm64. Nx Cloud disabled throughout.

- Before the Angular policy amendment, three Nest12 cells passed: 14 reference, 14 current and 5 split checks.
  This includes strict npm ci and installed-tree checks, CJS/ESM declarations,
  exports, module/async/explicit HTTP, packed security and real split-server
  browser hydration/replay. The renderer retains its existing buffered body
  behavior; no new streaming/cancellation certification is inferred.
- All four maintenance cells passed against the unchanged baseline: 59 checks,
  including Angular21, Angular22, patched adapter11.1.29, both module formats and
  split SSR/hydration. This is compatibility evidence, not a fresh security
  certification of every historical Angular dependency.
- After the amendment, both active Nest12 cells pass: 14 direct and 5 split
  checks against the final narrowed tarball. The old reference cell fails strict
  installation with ERESOLVE on that same SHA256, as required by the new policy.
- SSR lint, typecheck and all 99 unit tests pass with the scoped Angular22.2
  and Nest12 build/test dependencies.
- Infrastructure tests: 12 lifecycle tests plus 9 locked-runner tests passed.
  Added tests reject wrong/missing external archive hashes and distinguish line
  selectors without changing dependency identities.
- Before narrowing, existing direct, two matrix and split CI targets passed.
  After narrowing, direct consumers and the one active matrix cell pass again;
  the split target also passes with the patched Angular toolchain.
- All 10 CI-selection/graph/aggregate tests passed. No hosted run was inspected,
  started or rerun. Existing job IDs, affected selection and required `main`
  aggregation remain unchanged; the matrix inputs now describe the feature line.
  A fresh effective-rules read confirms only `main` / GitHub Actions15368 is
  required, with strict checking. No protection setting was changed.

The existing CI entry points remain in place. This bounded alignment prevents
main from installing a Nest12 package into the obsolete Nest11/Angular21 cells;
#740 retains frozen-matrix CI certification, broader security/HTTP/lifecycle proof
and platform evidence. #738's seven frozen locks remain available for line-specific
validation. Local passing checks are not a completed #740 certification.

## Security finding and accepted policy amendment

A fresh runtime-only npm audit on the exact frozen reference lock reported
**three affected package records (two high, one moderate)**: platform-server,
router and SSR. This is separate from successful behavior tests. Relevant
upstream advisories include:

- [Router numeric matrix parameter DoS](https://github.com/angular/angular/security/advisories/GHSA-ff3f-86qr-9cv3)
- [Router empty-path outlet DoS](https://github.com/angular/angular/security/advisories/GHSA-62vg-58rm-qff7)
- [CommonEngine Windows sibling traversal](https://github.com/angular/angular-cli/security/advisories/GHSA-7g7c-h8rr-7p6q)

The exact Angular22.2.6 / SSR22.2.7 current runtime lock reports **zero npm
advisories** at this check. That result is not a complete security audit.
Johan explicitly approved narrowing the initial Nest12 peers to Angular
`~22.2.6` / SSR `~22.2.7` on 15 November 2026. The dated #737 amendment records
that decision. The frozen `N12-reference` cell and earlier passing artifact
remain historical evidence; grouped feature selection excludes it. An explicit
run against the new archive must fail strict installation. This is an intentional
support boundary, not a silent skip or a claim that the old versions are secure.
The Nest11 maintenance manifest and its frozen cells remain unchanged.

The active feature proof now consists of `N12-current` (CJS/ESM) and `N12-split`.
The existing CI matrix likewise selects only the patched Angular22.2 cell;
direct and split CI inputs use the same patched train. SSR-local development
dependencies and the two direct consumer workspaces resolve that train, preserving
one Angular type identity across their declarations. Root Angular development
dependencies and other packages' published peer contracts remain unchanged.

Nx23.2.1's `@nx/nest` tooling peers still expect Nest11 and Yarn reports that
mismatch after the root runtime upgrade. The package build, types, unit checks
and real locked consumers pass independently. This is not a claim that Nest12
schematic generation is supported by this workspace; no Nx-wide migration or
schematic generation was performed. #740/#741 should retain this distinction.

## Review status

The local implementation is ready for Johan’s review. Both active feature cells
pass 19 checks, the separate maintenance baseline retains 59 passing checks,
99 package unit tests and 21 infrastructure/lifecycle tests pass, and all 10 CI
selection tests pass. Immutable Yarn installation, scoped ESLint and formatting
pass. The historical Angular22.1 install fails as intended; it is not part of
the active support claim. No runtime source or export change was necessary.

## Remaining gates

Johan's implementation acceptance, passing normal CI, protected
maintenance source preservation before merge, #740 certification, #748 release
controls and #741 technical readiness remain separate. #722 stays paused and
#742 alone owns subsequent authorized publication. No tags, publication, channel
changes, consumer migration or deployment occurred.

## Delivery authorization

Johan authorized committing, pushing and opening the #739 PR with its normal
CI run on 15 November 2026. This does not authorize additional hosted monitoring,
reruns, merging, maintenance protection changes or release actions. Implementation
acceptance and the documented maintenance-branch merge prerequisite remain open.

## Workspace CI correction — 15 November 2026

The first [PR #756 CI run](https://github.com/anarchitects/anarchitecture-community/actions/runs/43708979805)
passed the independent Ubuntu/macOS packed-consumer jobs and the active Angular
matrix, but failed five workspace tasks. The CJS/ESM build and typecheck targets
resolved root Angular22.1.4 against SSR-local Angular22.2.6, producing incompatible
`PlatformRef` private declarations. The split backend's three Jest suites could
not load Nest12 ESM. Prior local packed-consumer installation had left fixture
`node_modules` directories that concealed the workspace-only resolution failure.

The two direct fixtures are now explicit Yarn workspaces with declared SSR links
and their own approved Angular22.2 dependencies. Their packed-consumer runner
copies source and configuration into temporary directories outside the repository,
substitutes the archive for the workspace dependency and removes source project
references. It leaves workspace installs and outputs untouched. Root Angular22.1
remains available to existing Editor.js contracts; no unrelated peer range or
Forms behavior is changed. The backend retains
ts-jest for its TypeScript and uses the already installed `@swc/jest` only for
Nest and content-disposition JavaScript. This also handles Nest's `import.meta`,
which plain TypeScript CommonJS transformation leaves intact. The obsolete
JS-only ts-jest configuration is removed. Nx infers the new transformer as a
test-cache input. See [Jest transformation guidance](https://jestjs.io/docs/code-transformation).

Validation uses Yarn-installed fixture dependencies and Nx cache disabled, so the
four consumer checks exercise CI's workspace resolution rather than a previous
packed npm install. The backend passes all three existing tests without mocks of
Nest or changes to runtime source.

Final local verification passes all 61 build/typecheck/test/lint tasks across
17 Nest and Editor.js projects with cache disabled, both isolated direct packed
consumers, all 10 CI-selection tests and immutable Yarn installation. The four
workspace consumer checks pass again after packed validation, with Yarn's SSR
source link and Angular22.2 dependencies intact. The refreshed locked proof passes
all 19 active direct/split checks, including SSR/hydration, on the same tarball
SHA256 as before the CI correction; its new input hashes are in the companion
evidence JSON. Hosted success of this correction is still pending normal CI.

Before the correction, reviewed the intervening Meta amendments through
`4f0339d86f0ebfa073173ad307cb67c8d6042bdd`, including accepted ADR0022 and the
amendments to Modern Angular0008 and 0009–0012. Latest-stable feature development
and prospective 90-day previous-major maintenance do not activate a release or
invent an EOM date. Existing commitments remain protected; #741/#748 must record
the actual successor publication trigger and owner-reviewed transition. No
architecture or public compatibility change beyond the approved #737 policy is
introduced by this correction.
