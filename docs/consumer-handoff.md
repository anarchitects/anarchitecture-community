# Consumer requests, local exceptions and adoption

Use the existing consumer and upstream issues to connect a need to an accepted
result. This guide applies the [Community SDLC](sdlc.md) and accepted
[Meta ADR0018](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0018-upstream-first-exceptions-and-cutover.md).
It adds no release authority, universal cutover deadline or separate tracking system.
The [dated handoff review](consumer-handoff-review-723.md) shows three real cases
and the follow-up left with their owners.

## Route the need and identify the owners

Record shared bugs or missing functionality upstream, linking the consumer need
and its acceptance criteria. Search for existing work before opening another issue.
Keep application implementation and adoption in the application's repository;
Community owns its public supporting packages. Bricks owns domain implementation,
Contracts owns shared public HTTP contracts and Plugins owns Nx integration.
An application-local implementation does not transfer upstream ownership.

Use [OWNERSHIP.md](../OWNERSHIP.md) for Community and the
[central register](https://github.com/anarchitects/anarchitecture-meta/blob/main/docs/ownership.md)
plus the consumer's local record for the other roles. Resolve missing or conflicting
assignments explicitly. A reporter, assignee or repository maintainer is not
automatically the App PO or capability owner. A tooling package consuming Community
has a capability owner; it does not acquire an invented App PO.

Link the upstream and consumer issues in both directions. State whether each
promises implementation, publication, adoption or a live outcome. Keep a single
issue when one small outcome suffices; split separately accepted work when needed.
An existing issue paragraph or linked decision is enough: do not copy the whole
upstream specification into every consumer issue.

## Record an exception and its individual cutover decision

When upstream timing affects an application release, the **App PO and the relevant
domain/capability owner jointly decide** whether a bounded local implementation is
justified. Record that decision with the application work and link it upstream.
The same owners decide the transition to upstream. One person may hold both roles;
identify the roles involved without inventing a two-person approval requirement.

Use these prompts where applicable, linking existing evidence instead of repeating it:

| Record                  | What the owners establish                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Need and release impact | Affected capability and application; why waiting matters; the release scope affected, if agreed.                                                               |
| Local boundary          | The smallest local behavior, its exclusions, compatibility constraints and maintenance/removal cost.                                                           |
| Joint decision          | Named App PO and domain/capability owner, dated decision links, approved scope or an explicit pending decision.                                                |
| Upstream dependency     | Owning issue and required behavior/version/support evidence; distinguish available parts from unresolved work.                                                 |
| Cutover conditions      | Individually agreed readiness, migration and validation conditions, staged steps if useful, and how the owners revisit the plan. Record timing only if agreed. |
| Accepted result         | Consumer revision and actual package identities, validation of the promised behavior, treatment of replaced code, and the owner's acceptance link.             |

These are prompts for a reviewable decision, not a new common release checklist.
Silence, a merged PR and package publication do not establish joint approval. If an older
exception lacks a linked decision, ask the owners to link or reconcile it; do not
invent retrospective authorization or invalidate unrelated completed work.

A migration plan can retain local code temporarily or stage its replacement.
Record remaining scope and the next owner action. There is no automatic “next
sprint” deadline and no silent change to the application's accepted release scope.
Competing priorities are resolved jointly by the involved owners.

## Keep reuse public and application concerns local

Prefer suitable published public ecosystem packages. **Shared private packages are
prohibited**, including between private applications or in an exceptional multi-app
workspace. If reusable functionality is not ready for public reuse, keep the local
implementation inside the application and plan appropriate public upstream extraction.

Keep private identity, taxonomy, content, consent wording/history, credentials and
site configuration local. Public handoff records contain only the necessary shared
contract and evidence references; link access-controlled consumer evidence instead
of copying private application data into Community. Missing access is an evidence
limit, not evidence of acceptance.

Community's private workspace root, fixtures and validation tools are internal
assets, not distributed shared private packages. They establish package behavior
only for the tested combinations; they are not independently deployed products,
application acceptance or sprint-gated applications. Extraction and handoff preserve
the accepted package boundaries, supported contracts and compatibility gates.

## Hand publication evidence to the consumer

The Community owner accepts the upstream result and separately authorizes release
under the [release controls](release-controls.md) and [execution runbook](release-execution.md).
Link the actual published package/version, immutable source/artifact identity,
applicable compatibility evidence and limitations. An intended version, tag, green
build or packed fixture alone does not prove registry publication. Use the evidence
already retained by the release process; repeat proof only where changed artifacts
or the consumer's acceptance criteria require it.

The consumer records its own installed versions, revision and applicable validation,
then its owner accepts the promised result. Where adoption promises live behavior,
link the accepted deployed candidate and operational evidence too. A general product
acceptance record may need reconciling with narrower unfinished checks; do not
silently discard either. Upstream publication does not prove that local code was
replaced, data migrated or the consumer deployed.

Capability/domain tags may be created by the owner or authorized automation.
**Only the application's App PO creates its application release tags**, including
hotfix tags, and authorizes application release and rollback. Infra executes the
approved operation. The manual-to-automated Infra handoff remains governed by
[Meta ADR0020](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0020-application-infrastructure-boundary-and-migration.md)
and the owning repositories; this guide does not implement that migration.

## Reconcile planning at each handoff

Use the [existing intake forms and review conventions](../CONTRIBUTING.md#intake-planning-and-acceptance).
Feature requests already have a consumer-follow-through field; operational work
has an authorization/follow-through field. Put the decision links there or in the
existing issue body. No new issue type or project field is required.

Community's maintainer reconciles Status and **Blocked by** in
[project #16](https://github.com/orgs/anarchitects/projects/16) with the source issue.
The consumer's owners maintain its execution project. When publication resolves a
dependency, remove that blocker and reassess the next step; preserve other necessary
dependencies. Do not start implementation or assign a target release/iteration
merely because work became Ready. Link selected high-level outcomes in the existing
[overview #26](https://github.com/orgs/anarchitects/projects/26) under the
[planning conventions](sdlc-planning-migration-717.md#organization-overview-and-reconciliation);
matching field names do not synchronize values.

Record owner acceptance before Done. Preserve accepted upstream work when consumer
adoption remains open, and keep follow-up in the repository that owns it. Use
`Closes` only when a PR satisfies the whole promised outcome; otherwise use `Refs`.
[Meta #37](https://github.com/anarchitects/anarchitecture-meta/issues/37) owns
cross-repository compatibility evidence aggregation; link to it rather than building
another dashboard or dependency graph here.

Release activation remains a separate [#722 permission cutover](release-permissions.md).
Following this guide neither unpauses it nor authorizes publication, deployment or
CI spending. Monitoring, reruns and hosted experiments need their own explicit
permission. Existing renderer cache/DTE exceptions remain separate from adoption.
