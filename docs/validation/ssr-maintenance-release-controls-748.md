# Protected SSR maintenance releases — #748

Status: **detailed design accepted by Johan**, 15 November 2026. Implementation
delivery is under review. Johan accepted the exact SSR branch/package/channel
allowlist, main-only privileged execution and owner-reviewed protection snapshots,
in addition to the previously accepted maintenance-first ordering. He separately
authorized committing, pushing and opening the PR with its normal CI run.
#740 is closed at Johan's explicit request. #741 still depends on #748. #722 is
paused until release planning; neither this work nor its tests activate it.

## Delivery update — 15 November 2026

PR #759 merged as `9938077fc04843e7afc19da101e479707cd3a7c8`; #748 is closed.
The implementation prerequisite for #741 is resolved. The opening status and
security results below describe the original review. See the
[#741 readiness record](nest12-ssr-readiness-741.md) for patched maintenance
consumer evidence and the still-pending live source/protection setup. #722 stays
paused; implementation delivery is not live activation.

## Decision and exact scope

The approved adapter minimum `^11.2.10` is a breaking Nest 11 installation change.
It cannot ship as a compatible `0.3.3` patch. On 15 November Johan answered
**“Prepare maintenance first”**: derive and publish the patched Nest 11 successor
before deriving the Nest 12 feature version from that distributed baseline.
Today's illustrative sequence is `0.3.2 → 0.4.0` for maintenance, followed by
`0.4.0 → 0.5.0` for the feature transition. These are not reserved versions.
Fresh complete history and installed Nx Conventional Commits remain authoritative.
A collision stops preparation; there is no manual skip, version reset or tag rewrite.

The controller allowlist is deliberately small:

| Line     | Package / Nx project                                       | Reviewed source                                                                               | Initial npm channel | Separately reviewed channel actions |
| -------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------- |
| `nest11` | `@anarchitects/nest-angular-ssr` / `nest-angular-ssr` only | `maintenance/nest-angular-ssr-0.3`, descended from `8ff34b9d627d8031321f5ac45b526ec03ed05578` | `nest11`            | `nest11` only                       |
| `nest12` | Same single package/project                                | `main`                                                                                        | `next`              | `next` or `latest`                  |

The maintenance branch keeps its previously selected name for continuity; the
`0.3` suffix does not force a breaking change into the old numeric minor. The
logical line is `nest11`. Its approved floor source already exists at
[`4f10043`](https://github.com/anarchitects/anarchitecture-community/commit/4f10043d9cf49020d5e8583b5cfc2917de3efd9f).
Do not merge that old-source branch into Nest 12 main. No branch, version, release
tag or registry channel was created by this implementation.

No arbitrary line, package, dependent release, prerelease or `1.x` transition can
use this exception. The source manifest must retain the reviewed Nest 11 or Nest
12 adapter contract. Changes to peers/engines require breaking compatibility
evidence; the existing SemVer guard rejects an insufficient Nx-derived bump.
Angular maintenance security findings remain unresolved, not waived by the floor
decision. New features/adapters remain on the feature line.

## Controller and evidence boundary

All preparation dispatches and credentialed release/publish jobs remain on
protected **main**. `release-prepare.yml` checks source admission before checking
out maintenance. It uses an immutable SHA, not an arbitrary ref expression. A
separate maintenance checkout supplies builds and package bytes; the preparation
entry point and final consumer harness come from the main checkout. Candidate
release scripts are never selected as the privileged controller.

Preparation has contents/actions read permission, no environment, App key,
registry token or publication OIDC. Candidate installs, package checks, final
build/pack and consumer execution remain unprivileged. The mutation jobs retain
their built-in-only controller and do not install, build or execute candidate
code. This is the existing reviewed-source trust model, not a sandbox guarantee
for arbitrary hostile build scripts. Maintenance source must pass normal protected
review; a branch name alone is insufficient.

Schema 2 binds controller commit/digest separately from candidate commit/tree,
branch, ancestry anchor, integrated request digest, source lock digest, exact
source CI, compatibility, Nx baseline, channels, archive inventories and consumer
evidence. GitHub artifact provenance binds to the successful first-attempt **main
preparation run**, not to the maintenance SHA. The mutation controller rereads
the integrated request, source manifest/lock, baseline tag, source ancestry, CI
and effective rules. It verifies every retained evidence file and the final SSR
certification's archive, cells, audit and main harness identity as data.

Source rules must be effective, active rulesets with verified empty bypass
lists, signed commits, PRs, deletion/non-fast-forward protection and a strict
`main` check bound to GitHub Actions App `15368`. Inherited organization rules
are included. Missing rules or a classic-protection-only
configuration fail closed and need a reviewed settings reconciliation. This
implementation does not weaken main or add maintenance to privileged environments.

GitHub [returns bypass lists only to callers with ruleset write access](https://docs.github.com/en/rest/repos/rules#get-a-repository-ruleset).
Preparation does not gain that authority. When the API hides the list, the
controller requires a main-owned entry in `tools/release/source-protection.json`
for that branch/ruleset: `id`, Johan's `ownerId: 5003361`, verified empty
`bypassActors`, exact revision instant `updatedAt` and `publicDigest` from
`protectionRevision()`. Revision timestamps are validated and normalized to UTC
milliseconds before comparison and hashing; equivalent explicit offsets identify
the same instant. Missing, timezone-free, invalid or sub-millisecond timestamps
fail closed. No other ruleset fields are normalized or omitted from the digest.
An owner-authorized settings read-back must verify the full list and the same
public revision before the entry is reviewed and merged. Fresh API reads must
still match that revision instant/digest and every required effective rule. Missing or
changed evidence stops execution; a visible nonempty bypass list always rejects.
This relies on GitHub's ruleset revision metadata plus the owner's attestation,
not on hidden data being empty. The snapshot file is intentionally empty until
the separately authorized settings reconciliation. No administrative token is
placed in preparation or candidate jobs.

The #742 correction migrates the two reviewed snapshots to canonical UTC and
their corresponding digests after confirming unchanged rules and empty bypass
lists. Older representation-dependent digests are not accepted as a fallback.
See the [failure and correction record](ssr-publication-planning-742.md#protection-timestamp-correction--15-november-2026).

The exact CI run must be a successful `ci.yml` push run on the selected source
branch/SHA with the successful `main` aggregate and no failed jobs. New tags
require the candidate still to be that branch's head. Existing-tag recovery
instead preserves its original commit. Controller drift, moved baselines, changed
history or bytes, old attempts and missing numeric-owner approval still stop work.

## Version and channel behavior

Maintenance uses Nx `releaseTag.checkAllBranchesWhen: false`: only reachable
tags can establish its baseline. Every remote package tag is reconciled with
local history; npm must contain the baseline. A lower new maintenance version
may follow a higher feature version, but it must advance the reachable line and
remain globally unused. All remote tags, releases and npm versions stay in the
collision and execution-history checks.

The feature line uses `checkAllBranchesWhen: true`. Its initial transition cannot
proceed until the patched Nest 11 version has a Git tag, GitHub Release and npm
distribution. That published version becomes an eligible Nx baseline even though
its source is on maintenance. No merge of maintenance implementation into main
is needed. This setting is explicit and tested against installed Nx 23.2.1.

Initial feature publication is `next`. The immutable record explicitly lists
`latest` as an allowable future channel target; a **new dispatch and owner
environment review** are required to select it. The controller verifies existing
bytes before any channel move. The allowance is not transferable approval.
Maintenance records allow only `nest11`; the npm command names it explicitly and
checks that `latest`/`next` did not change during its operation. Publication and
channel mutations share the existing serialization and receipt/recovery controls.

## Operator handoff after separately authorized setup

1. Merge the reviewed #748 implementation on main. Keep #722 paused.
2. With separate settings/CI authorization, establish the maintenance branch from
   the recorded Nest 11 ancestry, apply the same effective source protections,
   integrate the accepted floor commit through its reviewed source route and
   backport the `ci.yml` maintenance-push trigger. Preserve the branch's Nest 11
   package/consumer jobs; do not copy main's Nest 12 dependency graph or controller.
   Read back effective rules and verify the exact required CI contract. Capture
   the owner-reviewed main and maintenance protection snapshots described above
   and merge them into the main controller before hosted preparation. A later
   settings change requires another read-back/review; do not simply refresh hashes.
3. Resolve the retained Angular runtime advisories with reviewed dependency/lock
   changes and prove all promised maintenance cells. This work introduces no
   dependency upgrade or security exception. Retain the old-floor rejection proof.
4. Use a separate clean main checkout for trusted release tooling and a clean
   maintenance checkout at its reviewed head. Run the main copy of
   `tools/release/prepare.mjs version` from the maintenance directory with
   `--projects=nest-angular-ssr --line=nest11 --channel=nest11` and an external
   `--compatibility` file containing `minimumBump: "major"` for the floor migration.
   Use the reviewed Node/Yarn toolchain and `NX_NO_CLOUD=true NX_DAEMON=false`.
   Preparation writes the version/changelog/request diff only. Submit that diff
   through maintenance protection and obtain exact versioned-candidate CI.
5. With hosted preparation authorization, dispatch `release-prepare.yml` on main
   with `line=nest11`, the exact `source_commit` and `ci_run`. Review the retained
   record, archives and proof. Actual mutation still requires #722 activation,
   exact owner release intent and each environment approval.
6. Once maintenance is genuinely distributed, prepare Nest 12 from main with
   `--line=nest12 --channel=next`. Freeze via a main dispatch with `line=nest12` and
   the exact main CI run. Use the same tag/archive controls. For later promotion,
   dispatch `publish-controller.yml` with `operation=channel`, `channel=latest`
   and the same immutable record/tag; obtain fresh owner review.

If main's controller changes between maintenance version preparation and freeze,
refresh/review the request with the current controller and rerun exact candidate
CI as authorized. Never patch the retained record. If artifacts expire or an
already published candidate cannot be represented by a new record, use the
existing separately authorized recovery procedure. Johan retains records, exact
archives and receipts on encrypted USB **Anarchitects**, with the second backup on
**Asustor Lockerstor AS6604T**, before GitHub's 90-day retention expires.

## Validation and limits

Final local checks: **44 release-policy tests passed**, as did
`validate-release-policy`, `test-ci-selection`, Nx formatting and relative file
link/whitespace checks. Nx Cloud was disabled. The expected failing maintenance
audit below is recorded separately from these passing controller checks.

The local release-policy suite exercises actual installed Nx against disposable
divergent Git histories, including version/changelog preparation without commits,
tags or pushes. Fake GitHub/registry responses test lower maintenance patches,
global collisions, unshipped/wrong baselines, inadequate bumps, forged provenance,
source/controller drift, CI branches, request/lock/manifest bindings, source rules,
channel promotion, evidence tampering and existing retry/partial-publication rules.

The retained floor archive `c3d4ef9703d113bf00c53fe596b48491afdb3efcd816bf4f72d872ef9a8fac91`
was installed again in all three locked Nest 11 cells. **45 compatibility checks
passed; all three fresh runtime audits failed**, correctly blocking a new release
record. Angular 21 cells each report 7 affected packages (5 high, 2 moderate);
the Angular 22.1 cell reports 3 (2 high, 1 moderate). The development archive still
has version `0.3.2`; it must never overwrite the already published version.
See the [local evidence summary](ssr-maintenance-release-controls-748-evidence.json).

These tests establish local controller behavior and expose the remaining package
security prerequisite. They do not establish live maintenance protection, hosted
preparation/CI, environment/registry trust, publication, EOM or downstream adoption.
#741 must assess the concrete path and unresolved security work; #722/#742 remain
the activation/publication gates. No new framework maintenance date is invented.

## Architecture preflight

All **25 Meta ADRs** at `4f0339d86f0ebfa073173ad307cb67c8d6042bdd` and all **nine
Community ADRs** at `e44140c` were enumerated and read, every status, along with
CONTRIBUTING, OWNERSHIP, SDLC, release/version/execution and CI/protection guides,
the accepted #737 amendments and relevant Modern Angular SSR/testing guides.
Meta0013/Community0007 retain Nx versioning and compatibility bumps;
Meta0015 keeps fresh history, installation, audits and mutations uncached;
Meta0016–0019 retain owner authority and honest delivery status; Meta0022 preserves
prospective, per-framework 90-day maintenance with no invented trigger date.
Community0004–0006 preserve packed documentation, the existing Fastify contract
and separate adapter delivery. No adapter, public runtime API, peer or dependency
change is made here. Proposed governance records retain their status.

The concrete conflict was the shared illustrative `0.4.0` identity after two
breaking transitions. Johan's maintenance-first decision resolves the ordering;
the implementation still rejects collisions and unsafe candidates. Johan's explicit
“Accept the detailed design” resolves the owner-design gate. Repository delivery
and the separately authorized live activation work retain their own acceptance gates.
