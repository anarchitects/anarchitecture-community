# Community release-control design

Status: **Accepted by Johan on 9 November 2026** under [#719](https://github.com/anarchitects/anarchitecture-community/issues/719).
This document records Community's accepted control design; it neither
implements them nor authorizes a release. The [dated inventory](release-controls-inventory-719.md)
separates observed behavior from unresolved settings. Workflow and permission
enforcement are tracked in #720–#722. The [#720 enforcement guide](release-version-policy.md)
records the commit/version validators now supplied; the full release path and
permissions remain staged pending #722. The [#721 execution runbook](release-execution.md)
describes the implemented preparation/controllers, local evidence and activation
handoff; it does not claim the new route is operational.
The [#722 settings record](release-permissions.md) separates verified live settings,
the proposed cutover and remaining activation blockers.

## Authority and architecture review

[OWNERSHIP.md](../OWNERSHIP.md) identifies Johan as owner for Auth, Governance,
SSR and Visual Composition, covering all 21 release projects. The authenticated
GitHub profile is `vrxj81`, numeric account ID `5003361`; Johan explicitly confirmed
this authorization identity with his design acceptance. No backup or delegation is
inferred. The same person may review technical readiness and authorize release,
acting in the appropriate role each time.

The all-status ADR preflight from #718 remains applicable: 24 Meta records at
`770b6d67d7a4479ec0226f0ac48beeb2534db6a2` and nine Community records, unchanged at
`ce588355789464be1b4ed75e9afcb9a5d156608c`. The release-scope review applies:

- Meta0016/0017/0019: ownership, separate acceptance and release authorization,
  continuously releasable capabilities, and owner **or authorized bot** tagging.
  Application tagging remains exclusively its App PO's responsibility; Community
  fixtures are not application products. There is no universal two-person rule.
- Meta0013 and [Community0007](adr/0007-package-initial-release-and-nx-versioning.md):
  independent Nx Conventional Commit versioning, exact project scopes, explicit
  bump mappings, first official distribution `0.0.1`, and preservation of history.
  Bricks domain version alignment does not apply to Community.
- Meta0012/0014/0015 and local architecture/compatibility ADRs: preserve public
  contracts, human review and merge of dependency updates, mandatory technical
  gates, correct cache boundaries and documented DTE limitations.
- [Community0004](adr/0004-public-package-documentation.md): verify consumer
  documentation in actual artifacts; keep operational evidence in repository docs.

No accepted decision conflicts with this design. Missing enforcement is not an
exception to policy. Proposed Meta layering/contribution-governance documents do
not grant authority. This is an application of accepted decisions, not a new ADR
or permission to redesign #712's CI selection or #667's packed validation.

## Owner-accepted controls

For every project in the inventory, Johan accepted the common controls
below and the relevant family-specific controls. This is a **local owner decision**,
not a newly imposed ecosystem checklist.

| Deliverables / owner role                         | Existing gates retained in the release evidence                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Better Auth TypeORM / Auth owner                  | Package build, types and tests; PostgreSQL-backed Better Auth integration/compatibility checks and packed public API coverage.                                                                                                                                                                                                                                |
| Nest Angular SSR / SSR owner                      | Package checks plus the existing `validate-nest-angular-ssr-release-gate`, including supported adapters, module formats and version compatibility. Preserve accepted adapter defaults.                                                                                                                                                                        |
| Seven Governance npm projects / Governance owner  | Applicable package and boundary checks, packed artifacts, public API/documentation, dependency ordering and runtime/host compatibility.                                                                                                                                                                                                                       |
| Governance Python host / Governance owner         | Python build/test checks, wheel and sdist inspection, and exact agreement between the packaged runtime manifest and the approved dbt runtime release.                                                                                                                                                                                                         |
| Governance dbt package / Governance owner         | Existing validate/pack checks, dbt manifest/version agreement and an installable Git tag/subdirectory. Packing alone does not prove distribution.                                                                                                                                                                                                             |
| Ten Editor.js projects / Visual Composition owner | Applicable authoring/rendering, packed consumer, supported Angular/Node, SSR/isolation, upload and security checks in the [stability coverage](editorjs-stability-coverage.md) and [release readiness](editorjs-upload-release-readiness.md#required-release-commit-gates). Verify exports, styles, README/LICENSE and dependency metadata in final archives. |

All families retain the [required `main` CI contract](main-branch-protection.md)
for the exact integrated candidate, with its reviewed affected selection and
intentional skips. Green CI is readiness evidence, never authorization. Identify
additional applicable release gates in the release record; a publisher's subset
of checks does not replace them. Evidence reused from another run must prove the
same artifact identity and satisfy the applicable gate's reuse rules.

The accepted [renderer G07 exception](editorjs-integrated-stability-review.md)
remains: local cache restoration is evidenced; renderer remote restoration and
actual Nx DTE are not. Renderer/CI maintainers revisit it before making those
claims. It does not waive exact-candidate green CI or authorize hosted spending.

## Accepted authorization-to-execution chain

Use the existing Nx versioning/changelog and bot-assisted tag/release machinery,
but separate preparation from public mutation. The present single release command
cannot stand in for approval of its not-yet-created versioned commit.

1. **Prepare the final candidate without publication authority.** Resolve exact
   release projects, Conventional Commit versions and all dependent version or
   publish effects. Include `updateDependents`, `^nx-release-publish` and the Python
   runtime-manifest hook; public npm dependencies alone are not the complete set.
   Prepare the Nx version/changelog changes through normal `main` protection,
   normally a release-version PR. Preparation must not create public tags/releases
   or receive the release bot's credential. Preserve signed commits and the
   required check. Do not change the versioning authority to version plans.
2. **Freeze and validate after integration.** Name the final commit on `main`,
   after all manifest/lock/version writers. Run applicable checks on that commit,
   create final archives without publishing credentials, and retain their bytes,
   digests and evidence. Do not use pre-version CI as evidence for a different
   final commit. Any required hosted run needs separate maintainer permission.
3. **Present one immutable release record.** Include the fields below. Resolve
   current tag/registry history freshly; errors or inaccessible history stop the
   operation. The reviewed record is not an editable issue comment or just a tag
   name: retain a versioned artifact ID and its digest, produced by the trusted
   preparation workflow, with durable retention through publication/recovery.
4. **Owner approves the mutation run.** Use protected GitHub environments as the
   initial mechanism: `community-release` for tags/GitHub Releases and
   `community-publish` for registry operations. Both have only the confirmed owner
   as required reviewer, self-review allowed, and administrator approval bypass
   disabled. Retain the review identity and decision with the run ID, attempt,
   workflow revision and release-record digest. Approval without accessible
   candidate/evidence is insufficient.
5. **Revalidate, then execute the approved action only.** After approval, verify
   owner mapping, record digest, candidate, versions, artifact hashes, fresh
   history and allowed mutation scope again. Acquire only the required short-lived
   credential in the execution job. The authorized bot may create the reviewed
   capability tags and GitHub Releases; it must not recalculate versions or choose
   scope. Candidate code, installs, builds and lifecycle hooks run without these
   credentials. Use a reviewed controller from protected `main`, distinct from
   checking out the candidate/tag as data. Serialize overlapping package/channel
   mutations and recheck history inside that boundary, including dependency
   publication, so two individually valid runs cannot race a channel update.
6. **Link and verify results.** Record tag object and peeled commit IDs, GitHub
   Release IDs, workflow attempts, registry identities, actual artifact integrity
   and channels, provenance where applicable, and clean consumer checks. Record
   partial completion explicitly. Publication does not establish consumer adoption.

The required release record contains:

| Field     | Required binding                                                                                                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authority | Each affected capability and confirmed owner identity; authorization action, time and workflow review receipt.                                                                                 |
| Scope     | Exact Nx projects, distribution names, registries, versions and channels; full dependency/version/publication expansion and reasons for additions. No arbitrary project/tag shell expressions. |
| Candidate | Repository identity, final commit and tree, source baseline, reviewed controller revision, lockfiles and tool versions.                                                                        |
| Evidence  | Exact-candidate required CI and applicable gate results; retained artifact IDs, file inventories and SHA-256 digests, supported compatibility and explicit accepted exceptions.                |
| Execution | Whether creating tags/releases, publishing specified files, resuming specified missing work or changing a channel; permitted bot/human executor, run and attempt.                              |
| Outcome   | Actual tag/commit and publication identities/integrity, remaining work, verification results and owner disposition of failures.                                                                |

For the current single owner, native environment review is the selected
approval mechanism; no custom authorization service or second reviewer is needed.
It deliberately requires review of the release run **and each separate publishing
run**. `release.published` still requests publication per package; it does not
carry transferable owner approval. Manual Publish uses the same checks and review.
Batching approvals across later runs would need a separately reviewed mechanism.

The release-event entry point must only forward the tag and record identity to
the controller dispatched on protected `main`, without registry credentials, OIDC
or the release App key. Limit any forwarding token to the required dispatch access;
the controller treats every request as untrusted and independently validates it.
Manual dispatch selects that same controller on `main`. This separation matters
because [release events use the release tag as their workflow ref](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#release),
while the designed privileged environments admit only `main`. Merely checking out
`main` inside a tag-triggered job does not change its event/ref identity. Legacy
tags without the new forwarder use the reviewed manual route; do not run their
old privileged workflow to recover. #721/#722 must verify this dispatch and trust
boundary before activation.

GitHub requires only one of an environment's listed reviewers. If ownership later
splits, separate owner-scoped approvals must cover every affected capability;
adding all owners to one reviewer list would not require them all to approve.
The [environment documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
describes the native review controls; #722 must verify their effective availability
and configuration before activation.

The owner may instead create the **same approved capability tag** manually and
record its commit/object identity and authorization. A tag push alone does not
start Publish: create the corresponding authorized GitHub Release or dispatch
Publish for that existing tag. The automated publish gate still applies. Manual
registry publication is a separately authorized recovery/bootstrap execution of
the same record, with local authentication and the same byte verification.

## Artifact and channel handoff

- **npm:** publish the reviewed `.tgz`, not a rebuilt directory. The installed Nx
  publisher currently publishes a package directory and can move dist-tags when
  a version exists. #721 must provide a narrow, reviewed exact-archive execution
  path while retaining Nx versioning/orchestration, or prove equivalent byte
  preservation. A successful Nx skip is not an integrity check. A channel move
  is an explicit mutation, even when it uploads no bytes.
- **Python:** publish only the approved wheel/sdist filenames and hashes, not an
  unchecked `dist/*`. Verify runtime pin, metadata and registry receipts for both.
- **dbt/GitHub:** bind installation to the approved tag, commit and package
  subdirectory. Record pack inspection evidence; the current publisher uploads
  no release asset. Do not claim an archive was distributed unless it actually was.

Publication, mutable authorization/history checks and channel mutation must not
be cached or distributed as build work. Deterministic preparation may use Nx
cache only with complete inputs/outputs and identity checks. Credentialed jobs
must not execute candidate-provided scripts; retain npm provenance/OIDC through
an explicitly verified publishing route.

## Bootstrap, retries and recovery

| Situation                                                               | Required disposition                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New package, no distribution history                                    | Prove absence across relevant tags, releases and registries; enforce `0.0.1` in manifests/tag/artifacts. Review registry onboarding before release. A network/auth failure is not absence.                                                                                           |
| Already released, or adding another channel                             | Preserve real history; no first-release reset. Check the intended existing version and compatibility, including historical source/tag/registry discrepancies.                                                                                                                        |
| npm bootstrap                                                           | Verify current package access/trusted-publisher support. If local first publication is necessary, owner authorizes the exact archive/version and authenticates locally. No placeholder publication or credentials pasted into logs. npm staged publishing is not adopted implicitly. |
| Python bootstrap                                                        | A [PyPI pending trusted publisher](https://docs.pypi.org/trusted-publishers/creating-a-project-through-oidc/) can create a new project; verify its exact trust before use. Do not assume npm's onboarding constraints apply.                                                         |
| Retry / rerun / interrupted batch                                       | New attempt, fresh history and owner review. Identify the original record and exact remaining mutations. Verify already-published bytes and channels before skipping; publish only absent approved artifacts. Do not replay dependency publication blindly.                          |
| Candidate, scope, versions, channel, artifacts or controller changed    | Invalidate the affected approval and evidence; create a new record, revalidate and obtain owner approval. If `main` advances before tagging, prepare/review a new current candidate. A retry of already-approved tags instead verifies their original fixed identity.                |
| Missing/expired artifacts, unverifiable receipt, revoked owner or trust | Stop before mutation. Rebuilding creates a new candidate artifact record requiring validation and approval, even if source is unchanged. No fallback to unreviewed credentials.                                                                                                      |
| Conflicting existing tag/version or wrong registry bytes                | Stop and report; never overwrite a published version or move/delete a release tag to make the retry pass. The owner decides correction, new version, deprecation/yanking or channel recovery.                                                                                        |
| Rejected/absent approval, dispatch by non-owner, old workflow/ref       | A dispatch can request work but cannot authorize it. Reject mutation without valid owner review and the trusted controller/record. Old tags must not regain publication access through legacy workflows.                                                                             |
| Emergency/manual recovery                                               | Same owner, record and gates; separately authorize the exact recovery operations and authenticate locally. Maintainer/admin/Infra status alone is not an emergency bypass. Preserve audit evidence and verify the public result.                                                     |

## Permission design and safe activation

The accepted settings design is a target for #722, **not observed enforcement**:

- Protect release-tag creation for the exact release-project patterns: owner
  identity directly where supported, otherwise through an appropriate owner-only
  team/role, and the authorized release
  App. Protect tag updates/deletions separately so a creation bypass does not
  silently permit rewriting history. Read effective inherited rules as well.
- Scope the App installation to necessary repositories and permissions. Keep its
  private key only behind the release environment; remove equivalent unguarded
  repository/organization credentials. Retain the existing main bypass until its
  necessity and replacement are verified; the accepted preparation PR route
  should remove the need for bot bypass of normal version-commit review.
- Limit controller refs to protected `main`; candidates are immutable inputs, not
  executable release controllers. Bound registry trust to repository, workflow
  and `community-publish`. Verify **every** configured publisher/token path so an
  old environment-free trust cannot bypass review. Narrow default workflow token
  rights and grant OIDC only to the reviewed publishing job.
- Preserve an authenticated owner-operated recovery path. Registry collaborator,
  2FA, token and trust settings need administrative read-back. npm's
  [trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/)
  includes environment binding and per-publisher allowed actions; historical
  provenance is not proof of these current settings.

Stage the change without pretending that a partially installed gate is effective:

1. #720 supplies local version/history validators; #721 prepares/tests the complete
   controller and operator procedures. Keep production mutation activation gated
   until #722's settings read-back and owner acceptance. No automatic cutover on
   merge and no real publication merely to test the design.
2. Before changing production credentials/trust, the owner agrees a bounded release
   maintenance window and confirms a usable manual route for the reviewed bytes.
   Quiesce release/publish executions; reconcile pending approvals/partial runs.
   The current route remains subject to explicit owner authorization until then.
3. Configure environments, restricted credentials/trust and rules as one controlled
   cutover. Remove overlapping unguarded paths before reopening automation; legacy
   tag/event workflows must be unable to obtain publication authority. Verify
   allowed/rejected identities and refs without tags or publication, using separately
   authorized hosted evidence only where necessary.
4. Read back effective settings and accept the documented route before use. If a
   product/access limit prevents enforcement, retain the controlled manual route
   or keep releases paused pending owner disposition. Do not silently restore
   broad credentials or claim completion. No unusable route is accepted as rollout.

## Implementation handoff and acceptance

| Slice                                                                       | Concrete follow-through                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [#720](https://github.com/anarchitects/anarchitecture-community/issues/720) | Exact scope/type/init rules; complete explicit bump map; fresh multi-channel history; tag/manifest/archive and compatibility checks; positive/negative local tests. Resolve the recorded Governance history before affected releases.                                                                                                                                                |
| [#721](https://github.com/anarchitects/anarchitecture-community/issues/721) | Separate version preparation, immutable evidence and mutation; native owner review; safe inputs; dependency closure; trusted controller; exact-archive adapters; idempotency/channel checks; manual/event/retry parity and operator commands. Test stale/forged/missing approval, controller drift, artifact tampering, history failures and partial recovery without public writes. |
| [#722](https://github.com/anarchitects/anarchitecture-community/issues/722) | Current/proposed settings diff; confirm owner identity, organization credentials, App installation, environment features, tag rules and registry trust/access; controlled cutover/read-back and explicit residual limitations.                                                                                                                                                       |

On 9 November 2026, Johan explicitly answered **“Accept design and identity
mapping”** when asked to accept this document for Auth, Governance, SSR and Visual
Composition and confirm `vrxj81` / `5003361`. That acceptance covers staged candidate
preparation, review of the release run and each separate publishing run,
exact-artifact recovery, and unresolved settings as **activation blockers** for #722.

This completes the owner-decision requirement of #719; merge of this record
completes its repository handoff for #720. The acceptance does not approve a
particular release, hosted validation, workflow/settings implementation or exemption
from technical gates. Material design changes return to the affected owner.
Separate permission to push this documentation and open its PR covers the normal
CI run only, without monitoring or reruns.
