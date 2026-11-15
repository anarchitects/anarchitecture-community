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
   Do not announce the historical 26 November calculation as an accepted date.
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
