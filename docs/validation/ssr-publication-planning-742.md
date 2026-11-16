# SSR publication planning — #742

Started **15 November 2026**, at Johan's request. Owner: **Johan**, SSR capability
owner and Community maintainer. Package: `@anarchitects/nest-angular-ssr`; exact
Nx project: `nest-angular-ssr`. This starts release planning and prerequisite
reconciliation, not publication or activation.

## Planning read-back before setup

- PR #760 merged at `093b7f7c9fa50dfbe9c883758c676cd7bd4efce2`; #741 was closed
  as completed. Preserve that closure. Its delivered documentation and local
  evidence do not establish the live operational gates listed below.
- [#741's record](nest12-ssr-readiness-741.md) retains 21 Nest 12 and 48 Nest 11
  checks, zero findings in five exact consumer runtime audits, and the separate
  development archive hashes. These are not final versioned publication bytes.
- The proposed maintenance source is still local:
  `fix/ssr-maintenance-readiness-741` in the isolated maintenance checkout, based
  on `4f10043d9cf49020d5e8583b5cfc2917de3efd9f`. The README, legal files, patched
  consumer locks and maintenance CI push trigger remain uncommitted there.
- Fresh GitHub reads confirm both the ancestry anchor
  `8ff34b9d627d8031321f5ac45b526ec03ed05578` and floor commit `4f10043` have valid
  verified signatures. The remote `maintenance/nest-angular-ssr-0.3` ref is absent.
- `COMMUNITY_RELEASE_CONTROLS` remains **paused**. Main ruleset `14374927` is
  active, includes only `~DEFAULT_BRANCH`, and returns an explicitly empty bypass
  list. The inventory returns three repository rulesets and no inherited set.
- Main rules retain deletion/non-fast-forward protection, signatures,
  squash-only PRs, and strict `main` status checks bound to GitHub Actions
  integration `15368`. No policy weakening is proposed.
- Both protected release environments require reviewer `vrxj81` / `5003361`,
  allow self-review and select only branch `main`. This API read does not replace
  the earlier UI verification of administrator approval bypass.
- `tools/release/source-protection.json` still has no branch snapshots.
- No CI status was inspected, run started, setting changed, release created or
  registry mutation performed during this planning read-back.

The full 25 Meta / 9 Community ADR preflight is retained in #741. Meta remains
at `4f0339d86f0ebfa073173ad307cb67c8d6042bdd`; a fresh enumeration found the same
records, and Community's ADRs/contribution/ownership/SDLC files are unchanged from
that review. Before setup, the complete 34-record preflight was repeated, including accepted,
proposed and historical material. The maintenance checkout has the same nine
records; its older lifecycle clauses were read and reconciled with current accepted
Meta0022. The local Modern Angular README/repository application/SSR-build and
testing guides were reviewed, alongside CONTRIBUTING, OWNERSHIP, SDLC and the
release runbooks. Accepted independent versioning, owner authority, main-only
privileged execution, framework lifecycle and Fastify compatibility boundaries
apply. Governance proposals and ADR0005's proposed paragraph remain proposals;
accepted Meta0022 binds independently. No architectural conflict or new exception
was identified. No runtime implementation or published support range changes here.

## Authorized setup scope

The existing [#748 design](ssr-maintenance-release-controls-748.md) supplies the
accepted branch/package/channel allowlist. The following is its operational setup,
not a new release mechanism:

| Surface                                     | Current                                        | Proposed                                                                                                                                                                             |
| ------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Maintenance source ref                      | Absent                                         | `refs/heads/maintenance/nest-angular-ssr-0.3`, initially at verified anchor `8ff34b9d627d8031321f5ac45b526ec03ed05578`                                                               |
| Source protection                           | Main-only ruleset `14374927`                   | A separate active `ssr-maintenance-source` branch ruleset, matching only that exact maintenance ref, with no exclusions or bypass actors and all current main rule parameters copied |
| Main protection                             | Existing active main rules                     | Unchanged; capture a fresh owner-reviewed snapshot of the existing revision                                                                                                          |
| Maintenance source change                   | Local floor commit plus reviewed #741 backport | Signed backport delivery through a PR targeting maintenance, including the breaking adapter-floor intent; never target main                                                          |
| Controller snapshots                        | Empty                                          | Separate main PR recording owner ID `5003361`, each actual ruleset ID, verified empty bypass list, exact `updated_at` and controller-calculated public digest                        |
| Privileged environments / tags / activation | Main-only / existing tag rules / paused        | Unchanged                                                                                                                                                                            |

Install the maintenance rules before creating the ref. Verify current main rules
again before copying them; stop on unexpected drift. Keep the exact existing
strict-check-on-creation behavior. If GitHub rejects ref creation because the
anchor lacks an admissible check, stop and report the concrete failure; do not
add bypass, disable rules or choose an unreviewed base. Inspecting source CI needs
explicit CI authorization even when it is a read-only prerequisite check.

After creation, independently read the effective maintenance rules and both full
rulesets. Validate them with the existing source-protection controller. Capture
snapshots only from that read-back; never attest an omitted bypass list as empty.
The future ruleset ID/revision cannot be filled in before the setting exists.

The maintenance PR combines the already accepted floor commit with the prepared
backport; its title/body must preserve **breaking** installation intent for
`@nestjs/platform-fastify ^11.2.10`, so squash does not lose that version signal.
Its normal PR CI is required. Merge remains Johan's action; the maintenance push
trigger supplies exact source CI after merge. The controller snapshot PR targets
main and uses normal protected review. Hosted runs and inspection require their
own explicit permission, included in the proposed bounded setup authorization.

Recovery: keep `COMMUNITY_RELEASE_CONTROLS=paused`, preserve the created ref and
its protections, and stop on any failed read-back or check. Correct a bad ruleset
through another reviewed settings change; do not delete protected history or
restore broad bypass. Main rules and release-environment admission are untouched,
so no rollback of those surfaces should be needed. Retain before/after metadata.

## Publication sequence and remaining decisions

1. Complete and review the protected-source/backport/snapshot setup above.
   #741's closed prerequisite remains historical; carry these live gates in #742
   and #722 instead of silently treating closure as settings evidence.
2. Resolve the prospective Angular 21 EOM decision and clean generated release
   notes described in #741. Johan confirmed no additional maintenance commitments.
   The [15 November decision below](#angular-21-transition-decision--15-november-2026)
   resolves the date with an approved extension through 13 February 2027.
3. Prepare the breaking **Nest 11** successor from the clean reviewed maintenance
   source using main's trusted controller, `line=nest11`, channel `nest11` and
   breaking compatibility evidence. Nx and fresh distribution history determine
   its version; the earlier 0.4.0 illustration is not reserved. Review/version PR,
   exact source CI and authorized hosted preparation freeze the final bytes.
4. Resume #722's deferred npm work when that real candidate is ready. Read current
   SSR publisher configuration and expiry, replace legacy trust with this repo's
   `publish-controller.yml` / `community-publish`, verify actual hosted publisher
   prerequisites, and obtain final activation acceptance. Resolve other retained
   legacy trust under #722 before treating the global route as fully activated.
   Do not create expiring connections merely for this planning step.
5. Obtain separate exact-version/artifact release authorization and protected
   approvals, publish maintenance to **nest11**, and verify receipts/registry bytes
   while preserving latest/next. Starting #742 does not authorize that mutation.
6. Derive **Nest 12** from the genuinely distributed maintenance baseline, repeat
   versioned candidate preparation/certification, then obtain exact owner approval
   for initial **next** publication. A later **latest** promotion is separately
   reviewed; its npm CLI/channel permission gate must also be satisfied.
7. Johan retains records, exact archives and receipts on encrypted USB
   **Anarchitects** and **Asustor Lockerstor AS6604T**. Verify both copies rather
   than claiming the earlier custody agreement proves backup.
8. Send actual published identities and evidence to the existing FitOverForty #150
   and Reeves Corner Retreats #29 handoffs when authorized. App PO deployment and
   adoption remain separate. Close #742/#578 only after Johan accepts publication.

Johan explicitly authorized this bounded setup, both PR routes, their normal CI
and required source-CI inspection on 15 November. Registry changes, activation,
tags, publication, merges, reruns and additional hosted experiments remain outside
that approval.

## Setup read-back — 15 November 2026

The authorized exact-ref ruleset **27324428**, `ssr-maintenance-source`, was
installed before branch creation. Every rule parameter matches main ruleset
14374927, including strict checks on creation, squash-only PRs, signatures,
non-fast-forward/deletion protection and an empty bypass list. Independent API
read-back matched the complete request. GitHub then accepted the exact branch
at the approved anchor without weakening or bypassing any rule.

The existing anchor [CI run 43706907743](https://github.com/anarchitects/anarchitecture-community/actions/runs/43706907743)
is successful, first attempt, `ci.yml` push on main at exactly `8ff34b9`; all
12 jobs, including `main`, succeeded. This is anchor admission evidence, not
future maintenance-release source-CI evidence. The branch will need its own
successful push run after Johan merges the maintenance PR, and another exact
run for the eventual versioned candidate.

[Read-back evidence](../evidence/ssr-source-protection-2026-11-15.json) records both
full rulesets, effective branch rules, exact revisions and computed digests.
The main ruleset is byte-for-byte unchanged from the planning snapshot. The
main-owned `source-protection.json` entries are submitted for owner review in
this PR; preparation must use their merged controller revision. Local validation
accepts both actual effective-rule sets and the corresponding hidden-bypass
snapshots, and rejects stale digests. This does not grant a read-only workflow
permission to inspect hidden bypass actors.

Every maintenance backport input hash still matches #741's exact-archive evidence.
No package implementation or fixture edit was made after its successful 48-check
certification. The backport will be delivered separately to the protected source
branch. Main's feature source and the two credentialed environments remain
separate. Activation remains paused; no publication evidence is claimed.

Local delivery checks pass: release-policy configuration and regression targets,
final formatting/diff checks, and maintenance immutable workspace installation.
The prepared maintenance files remain identical to the retained certification
inputs; no repeat consumer certification was needed for commit-only delivery.
Prospective PR-message checks preserve exact Nx scope and breaking minimum intent.

## Integrated setup and source evidence

Johan merged #762 into main at `bc977df6622b16e4dd82e34cdfbd6642ce20a093` and
#761 into `maintenance/nest-angular-ssr-0.3` at
`7ac811e3528e819c586079af66f52858a6227870`. Both exact push runs passed on attempt 1:
[main 43753934402](https://github.com/anarchitects/anarchitecture-community/actions/runs/43753934402)
(10 jobs) and [maintenance 43754067086](https://github.com/anarchitects/anarchitecture-community/actions/runs/43754067086)
(12 jobs), including each required `main` check. This completes setup/source
integration; it is not the later versioned-candidate CI or publication evidence.

## Angular 21 transition decision — 15 November 2026

**Accepted by Johan, SSR capability owner:** Angular 21 maintenance for
`@anarchitects/nest-angular-ssr` ends **13 February 2027**, inclusive, through an
explicit dated exception under Meta0022 clauses 4 and 8. The decision applies to
the Nest 11 maintenance source, `maintenance/nest-angular-ssr-0.3`, and its patched
successor releases. It does not extend another package's or Angular's upstream
support commitment.

| Field                        | Evidence / decision                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Historical successor trigger | `0.3.0`, published **28 August 2026 at 12:59:21.552 UTC**; npm metadata, the tag's Angular 21/22 peers and packed-consumer evidence in [PR #503](https://github.com/anarchitects/anarchitecture-community/pull/503).                                                                                                                                                                     |
| Nominal trigger + 90 days    | **26 November 2026**, retained as the historical calculation, not a retroactive support withdrawal.                                                                                                                                                                                                                                                                                      |
| Approved exception           | Maintenance through **13 February 2027**: 90 calendar days from the **15 November 2026** policy adoption/owner decision. Later patches do not restart it.                                                                                                                                                                                                                                |
| Reason                       | Give consumers a prospective transition after adoption rather than only the eleven days remaining under the historical calculation.                                                                                                                                                                                                                                                      |
| Commitments and consumers    | Johan confirmed no additional customer/application commitments. Known handoffs remain FitOverForty #150 and Reeves Corner Retreats #29; this does not claim adoption or assign their migration dates.                                                                                                                                                                                    |
| Scope and effort             | Johan retains responsibility for security/critical-defect backports and the existing Angular 21 packed-consumer/security checks on the maintenance line through the date. This retains limited old-major validation effort; no new features, adapters, broad new matrix, additional staffing or open-ended support is committed. Hosted spending still needs its existing authorization. |
| Migration and limitations    | Move to the verified Angular 22 combination while staying on Nest 11 if necessary. Preserve application-owned rollback and immutable artifacts. If a secure fix is unavailable, disclose the limitation/mitigation instead of promising unsupported coverage.                                                                                                                            |
| End / review                 | Angular 21 has no maintenance promise after the date. Any further extension needs a new explicit dated owner decision before expiry; it is not automatic.                                                                                                                                                                                                                                |

Nest 11's separate clock has **not started**: npm still has only releases through
`0.3.2`, with `latest → 0.3.2`. Record the actual first verified generally available
Nest 12 publication and its +90-calendar-day sunset when available. A `next`
channel label alone does not establish GA acceptance. After Angular 21 EOM, any
remaining Nest 11 window covers Angular 22. No peer range or archived artifact is
withdrawn by this decision, and App POs retain migration/deployment authority.

The complete 25 Meta / 9 Community ADR review was repeated for this lifecycle and
version-preparation scope at Meta `4f0339d86f0ebfa073173ad307cb67c8d6042bdd` and
Community `bc977df`. The maintenance branch's three historical ADR differences
were read alongside current accepted Meta0022. CONTRIBUTING, OWNERSHIP, SDLC,
Modern Angular overview/application/SSR/testing guides and release runbooks were
reviewed. Applicable constraints: Meta0013/0017/0022 and Community0004/0005/0006/0007;
Nx determines versions, owners decide lifecycle/release, APIs/Fastify behavior and
packed public documentation remain protected. Proposed local lifecycle prose
does not override accepted Meta policy. The approved dated exception resolves the
transition question without changing the architecture or adapter scope.

## Maintenance version proposal and release notes

The proposal below is historical. PRs #763/#764 integrated it; the
[timestamp correction](#protection-timestamp-correction--15-november-2026)
updates its controller binding without changing the proposed package version.

The clean main controller at `bc977df` prepared the reviewed maintenance source
`7ac811e` using `line=nest11`, channel `nest11`, `minimumBump=major` and fresh
GitHub tags/releases/npm history. **Nx derived `0.3.2 → 0.4.0`**, with no dependent
project version changes. First-release and stabilization modes are false.
The baseline is actually distributed; `0.4.0` was absent from all three histories.
This is a local proposal, not a reserved or published version.

The maintenance review branch contains the generated manifest and
`.release/request.json`, the updated public README and a cleaned package
`CHANGELOG.md`. The request binds the source baseline, exact project, compatibility
impact, channel and controller digest
`bc4d183d46ab5b8735a91f48b5ef4cdd425f1a2c29dfe60f4228012167ec962c`.
The changelog retains the breaking `^11.2.10` floor and adds packaging, coherent
patched combinations, migration and the approved sunset. It omits fixture/CI
chronology that could imply Nest 12 support on this line and does not invent a
publication date. The raw generated entry is retained locally at
`/private/tmp/742-maintenance-changelog-generated.md` for comparison.

The feature note copy below replaces the malformed trailing quote/file-status
text from #739/#756 and its stale claim that future maintenance remains `0.3.x`.
The original merged commit and published history remain unchanged. Apply this
copy to the **new** feature changelog entry after maintenance is distributed and
Nx derives its next globally unused version; do not prepare a colliding main
`0.4.0` or reserve the illustrative `0.5.0` now. Notes remain part of the exact
candidate's final owner review.

### Nest 12 release-note copy — version pending

**Breaking installation contract:** this feature line requires Node
`>=24.22.3 <25`, Nest common/core/platform-fastify `~12.5.0`, Fastify `~5.12.8`,
Angular framework `~22.2.6` and Angular SSR `~22.2.7`. It excludes Nest 11,
Angular 21 and Angular 22.1. Keep Angular framework/compiler packages coherent;
the verified build combination uses Angular build 22.2.7 and TypeScript 6.0.3.
Nx is build/validation tooling, not a runtime dependency.

**Preserved behavior:** `NestAngularSsrModule.forRoot` / `forRootAsync`,
`bootstrapNestAngularSsr` and the documented low-level APIs retain their
signatures. Fastify remains the supported adapter; Express and native Node are
not included. CJS/ESM Nest hosts and split ESM Angular server/CJS Nest composition
are covered. CJS hosts require Node's enabled `require(esm)` support.

**Migration:** select the actually published Nest 12 package version, upgrade
the coherent runtime/dependencies, build Angular before Nest, and validate SSR,
hydration, API misses, assets, host/proxy rules, cookies, redirects, HEAD and
not-found behavior in the application. Keep the prior reviewed application
artifact and full lockfile for owner-authorized rollback. The package includes
its own README, Apache-2.0 LICENSE and NOTICE.

**Maintenance:** Nest 11 consumers use the separately versioned patched
maintenance successor, whose adapter minimum is `^11.2.10`, on channel `nest11`.
Angular 21 security/critical maintenance ends **13 February 2027**, inclusive;
it can be migrated to Angular 22 while retaining Nest 11. Nest 11's 90-day window
starts on the actual first verified generally available Nest 12 package release;
record that release date and calculated EOM before claiming the clock has begun.
Older immutable artifacts remain available. Application owners control adoption.

**Distribution:** initial Nest 12 publication targets `next`; promotion to
`latest` requires a separate reviewed decision. Neither a mutable channel nor a
source manifest replaces inspection of the actual version and supported peers.

## Local proposal validation and handoff

[Machine-readable evidence](ssr-maintenance-version-742-evidence.json) binds the
generated request, source/controller revisions, reviewed files and actual archive
`anarchitects-nest-angular-ssr-0.4.0.tgz`, SHA-256
`9bb1dd58241414f0a0e5bc6893df6a41f9572d365cff583800b2f18c2318be12`.
Its **48 packed-consumer checks pass** across the two Angular 21 tooling cells
and Angular 22 direct/split consumers. All three runtime audits report zero
findings at their recorded times. Public CJS/ESM declarations and module/async/
explicit bootstrap behavior, SSR routing/security and split hydration are covered.
The existing 12 lifecycle and 9 locked-runner helper checks also pass.

The maintenance build passed without a cache hit. The archive's README, LICENSE
and NOTICE match the reviewed source byte-for-byte, including the accepted
sunset notice. Main's separate development archive also contains its updated
README/legal files; its unchanged `0.3.2` metadata is not a publishable candidate
and was not recertified as a feature release. Dates, relative links, formatting
and diff checks pass. Prospective scoped PR messages were checked through the
existing policy API with each actual uncommitted file list and fresh histories.
The first synthetic CI-event attempt lacked base/head metadata; it did not test
the message and was replaced by that appropriate local API check.

Prepared branches: `docs/ssr-lifecycle-notes-742` targets main, and
`release/nest-angular-ssr-nest11-742` targets the protected maintenance branch.
The new maintenance diff contains only the generated version/request, public
README and reviewed changelog; no runtime implementation, dependency range or
lockfile changed. The existing `^11.2.10` floor is already integrated.

The owner-approved date decision is complete. On 15 November, Johan authorized
committing, pushing and opening both concrete PRs with their normal CI runs;
**Johan will inspect CI**. Review/integration of the notes and `0.4.0` proposal
remains next. Exact versioned-source CI and
separately authorized hosted preparation must still establish the final candidate;
local bytes are not a hosted release record. #722 activation, npm trust and exact
release authorization remain pending. The local preparation above started no
hosted CI and performed no tag, registry mutation, publication, consumer handoff
message or release activation. Delivery authorization excludes agent CI inspection,
merges, reruns, hosted release preparation, npm changes, activation and publication.

## Protection timestamp correction — 15 November 2026

Johan merged #763 at main `238ebd3e133b6ece9dd2f189bb72525229bd774f`
and #764 at maintenance `cb69cc8ae58d0458366ae814884e9f8ea1551511`.
He then authorized exact source-CI inspection and one preparation after success.
[Source CI 43763535968](https://github.com/anarchitects/anarchitecture-community/actions/runs/43763535968)
passed all 12 jobs on attempt 1, including required `main` job `132968025121`.
[Preparation 43765244067](https://github.com/anarchitects/anarchitecture-community/actions/runs/43765244067)
used those exact revisions and `line=nest11`, but failed protected-source
admission with `Hidden bypass list requires owner-reviewed matching ruleset revision`.
Installation, builds and upload were skipped; the artifact inventory was empty.
That authorization was consumed; no rerun or publication followed.

Read-only public and privileged API comparisons isolated the mismatch to
equivalent timestamp spellings. The original checker compared and hashed raw
strings. The public response uses UTC while the privileged response uses `+01:00`.
For both rulesets, substituting only the reviewed timestamp spelling reproduced
the original snapshot digest exactly. Active rules, conditions and verified empty
bypass lists were unchanged. The failed job did not log its full API response;
the independent public-response reproduction supplies the diagnostic evidence.

The fix validates a timezone-qualified timestamp with at most millisecond
precision and normalizes it to UTC before comparison and hashing. It rejects
invalid calendar dates, missing zones and finer precision rather than guessing
or silently truncating a revision. Other public fields remain hash-bound;
revision changes, altered rules, missing/wrong-owner snapshots and visible or
attested bypass actors still reject. Both snapshots are migrated after the fresh
unchanged-settings read-back, with no legacy-digest fallback or settings mutation.

| Branch                                        | Canonical revision time    | Canonical public digest                                            |
| --------------------------------------------- | -------------------------- | ------------------------------------------------------------------ |
| `main` (14374927)                             | `2026-11-14T22:00:26.072Z` | `9d37d072477f901e8cd12058364384ed4ca34ab75c253bb33f49024f25725aaf` |
| `maintenance/nest-angular-ssr-0.3` (27324428) | `2026-11-15T18:26:26.128Z` | `6def06cfa7dfdfd5caaaefe30fdc66fc8f290fa7446086e9dd194a9e8d536405` |

Local branches are `fix/release-protection-timestamps-742` for main and
`chore/ssr-controller-refresh-742` for maintenance. The latter changes only
`.release/request.json`'s `controllerDigest` to
`27b4102058103cb724266faf71c8b8783c77f6db2dad379857cf81e3d4457ad5`.
This digest was calculated from the proposed Git tree using an isolated index
and the existing controller path selection, not from the unchanged main HEAD.
It must equal `controllerDigest()` after the reviewed main fix is committed and
again after integration. The maintenance version remains Nx-derived `0.4.0`,
channel `nest11`; source baseline, compatibility, manifests, locks and package
bytes are unchanged. Historical evidence above remains evidence for its original
source, request and archives, not certification of a new hosted record.

Validation: **45 release-policy tests pass**, including the equivalent-offset
regression, date/year boundaries, invalid timestamps and unchanged security
rejection cases. Release-policy configuration, formatting, whitespace and both
prospective commit/PR-message checks pass. Fresh unauthenticated
`sourceProtection()` calls pass for both branches with bypass lists hidden and
all five required effective rules present. No administrative credential is added
to preparation. Local proof does not claim that a new hosted preparation passed.

Johan authorized committing, pushing and opening both PRs with their normal CI;
**Johan will inspect PR and post-merge source CI**. He also authorized one new
main `nest11` / `0.4.0` preparation and its inspection, conditional on his merging
both PRs, integrated controller/request digest agreement and successful exact
maintenance-source CI. Preserve that successful run ID and source SHA for dispatch.
No merge or rerun is delegated. #742 remains open and publication-Blocked.
#722 trust/activation, exact owner release approval, durable archive copies and
consumer handoff remain separate unfinished gates.

The preflight reread all 25 Meta ADRs at
`4f0339d86f0ebfa073173ad307cb67c8d6042bdd` and all nine Community ADRs at
`238ebd3`, including the maintenance line's historical differences and every
status. CONTRIBUTING, OWNERSHIP, SDLC, release controls/version/execution,
CI/protection and #748 guidance were reviewed. Meta0013/0015/0016–0019 and
Community0007 preserve versioning, cache boundaries, ownership and authorization;
Community0004 keeps operational evidence here. Meta0022 and Community0005/0006
retain the accepted lifecycle/compatibility boundaries. No runtime API, adapter,
dependency or lifecycle decision changes; proposals do not override accepted ADRs.
No architectural conflict or new policy exception was identified.

## Preparation checkout isolation — 16 November 2026

Johan merged #765/#766 at main `871cb8d3e4d8a9056d4c62bb42bdda3fe0b58511`
and maintenance `2d7348bda9992c6268da2a4f36c90549564e51f5`. Exact source
[CI 43771710244](https://github.com/anarchitects/anarchitecture-community/actions/runs/43771710244)
passed all 12 jobs on attempt 1. The single authorized
[preparation 43821918512](https://github.com/anarchitects/anarchitecture-community/actions/runs/43821918512)
passed protected-source admission, installed dependencies and built/packed the
candidate, but failed before final consumer certification: Nx discovered the
nested maintenance checkout inside the main controller workspace, producing
duplicate projects and a second Playwright load. Upload/handoff were skipped;
the artifact inventory was empty. No retained or certified hosted bytes exist
from that run. Its one-run authorization is consumed.

Johan requested the next correction under #742. Branch
`fix/release-checkout-isolation-742` places main at `controller/`, with
`maintenance-source/` and `release-payload/` as siblings. Shell steps default to
the controller; maintenance install/build explicitly use the candidate. The
setup-node cache reads the controller lockfile, and standard/Nest 12/Nest 11
output arguments all resolve to the artifact uploader's directory. Main still
owns admission, preparation and the final consumer harness. Exact source/CI
bindings, permissions, credential-free candidate execution and paused release
activation remain unchanged. This follows the documented
[side-by-side checkout layout](https://github.com/actions/checkout/blob/v6/README.md#checkout-multiple-repos-side-by-side)
and setup-node's
[explicit cache dependency paths](https://github.com/actions/setup-node/blob/v6/docs/advanced-usage.md#caching-packages-data).

Validation: **46 release-policy tests pass**, including a new regression that
executes the actual freeze shell for all three lines with recording tools,
checks candidate/controller selection, resolves the main entry point and output
directory, exercises paths containing spaces and rejects unknown lines.
Release-policy configuration and formatting/whitespace checks pass. Independent
fresh Nx graphs from sibling copies of the actual main and maintenance trees
each contain **28 projects**, with no nested checkout roots or duplicate-project/
Playwright failures. These graph checks reuse each line's installed dependencies;
they are not clean-install certification, hosted execution or renewed archive
validation. No runtime, manifest or lock changed, so unrelated consumer suites
were not rerun. Final hosted certification remains required.

Companion branch `chore/ssr-isolated-controller-742` changes only the maintenance
request's `controllerDigest` to
`4e94c14ec301100fd13afbbbf238a62b4e40e9eb282b996a222ef55e4b9f6927`.
The digest uses the existing controller path selection and the proposed Git tree
from an isolated index; confirm it after committing and after main integration.
The request's baseline, Nx-derived `0.4.0`, compatibility and `nest11` channel
remain unchanged. Johan authorized committing, pushing and opening both PRs with
their normal CI runs; **Johan will inspect CI**. He separately authorized one
new Nest 11 `0.4.0` preparation on main and its inspection, conditional on his
merging both PRs, integrated controller/request digest agreement and successful
exact refreshed maintenance-source CI. This includes verifying that source-CI
result. The conditional authorization is unconsumed. No merge or rerun is
delegated. No additional hosted preparation, settings change, tag, npm mutation,
activation or publication occurred. #742 remains open and publication-Blocked;
#722 activation, exact release approval, archive custody and consumer handoff
remain separate gates.

The complete ADR/governance preflight recorded above remains applicable to this
same release-control scope. Meta main is still `4f0339d`; all 25 Meta ADRs and
nine Community ADRs are unchanged, as are CONTRIBUTING, OWNERSHIP and SDLC.
Accepted controller ownership, cache, version and release authority remain in
force; no architectural conflict or policy exception is introduced.
