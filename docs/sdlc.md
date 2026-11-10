# Community SDLC operating model

Community applies the [Anarchitects SDLC](https://github.com/anarchitects/anarchitecture-meta/blob/main/docs/sdlc.md)
as a provider of public integration packages and supporting capabilities.
[OWNERSHIP.md](../OWNERSHIP.md) maps every current publishable package to its
confirmed domain/capability owner and separates that authority from technical
maintainership. Meta remains the canonical process owner; this document describes
its application in Community.

## Authority and scope

Accepted Meta ADRs govern ecosystem boundaries. [Local ADRs](adr/) govern
Community implementation choices within those boundaries. Proposed decisions do
not override accepted decisions; record conflicts and obtain a decision from the
affected owners instead of silently choosing a new policy.

In particular, the [contribution-governance document](https://github.com/anarchitects/anarchitecture-meta/blob/main/docs/contribution-governance.md)
was still **Proposed** at this review. Its merged PR does not establish new
delegation rights. The proposed governance inheritance, layering and cooperative
enrichment models likewise remain proposals.

Community's domain/capability packages may release whenever ready and authorized.
They do not wait for application sprint end, and every merge need not publish.
Application product releases follow their own App PO and shared sprint calendar.
The fixture apps in this repository validate packages; they are not application
products assigned their own App PO or Infra deployment lifecycle.

## From work item to accepted outcome

Use [CONTRIBUTING.md](../CONTRIBUTING.md#intake-planning-and-acceptance) and the
issue/PR templates for intake and review. They apply this model without replacing
the canonical status/field definitions or the ownership inventory.

1. Identify the outcome, affected packages, responsible owner, acceptance criteria
   and dependencies. Consult the applicable accepted architecture and package
   contracts before implementation.
2. Make work Ready when scope, acceptance and ownership are sufficiently clear.
   Record any blocker with the responsible owner and the necessary next step.
3. Implement and review evidence appropriate to the change. The technical
   maintainer establishes technical readiness; the relevant owner accepts the
   promised outcome.
4. Mark Done only when that outcome is accepted. Implementation, publication and
   consumer adoption can be separate linked results. A live-outcome issue cannot
   be accepted merely because code merged, and publication does not prove adoption.
5. Record release authorization separately from readiness, execute the approved
   release, and retain links to its publication and consumer follow-through.

Use [Community project #16](https://github.com/orgs/anarchitects/projects/16) for
execution and the existing [organization overview #26](https://github.com/orgs/anarchitects/projects/26)
for selected high-level outcomes. The canonical statuses, fields and priorities
are defined in the [SDLC planning structure](https://github.com/anarchitects/anarchitecture-meta/blob/main/docs/sdlc.md#planning-structure).
Identically named fields do not synchronize values. Owners maintain the links
and resolve competing priorities jointly; no unilateral priority override or
unagreed deadline is introduced here.

The [#717 planning migration record](sdlc-planning-migration-717.md) documents
the reviewed work set, field mappings, workflow verification, overview
reconciliation and recovery procedure. Johan maintains Community's source and
overview links at planning and acceptance changes, coordinating with PWG for
overview-level decisions.

## Readiness, authorization, tagging and execution

| Decision or action                                                                 | Responsible role                                                                           |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Technical quality and readiness evidence                                           | Community technical maintainer                                                             |
| Capability/domain scope, compatibility, acceptance and release authorization       | Relevant owner in OWNERSHIP.md                                                             |
| Community release tag creation                                                     | Relevant owner, or automation/bot under that owner's authorization and applicable controls |
| Automated publication/execution                                                    | Automation executing the approved scope; it acquires no release authority                  |
| Consumer application release authorization and tag creation, including hotfix tags | That application's App PO; bots may not create application release tags                    |
| Consumer application deployment/recovery execution                                 | Infra executing the approved operation; application rollback requires App PO approval      |

This distinction follows [Meta ADR0017](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0017-release-cadence-and-owner-authority.md)
as clarified by [Meta PR #49](https://github.com/anarchitects/anarchitecture-meta/pull/49).
Community's bot-assisted Nx release route is permitted. A bot credential, workflow
dispatch, technical-maintainer role or successful CI result does not independently
authorize a release. Each owner defines the applicable controls while retaining
existing mandatory safeguards; the SDLC introduces no universal two-person review
rule or new common release checklist.

Keep [Community ADR0007](adr/0007-package-initial-release-and-nx-versioning.md)
and Meta0013's independent Conventional Commit versioning, initial-publication
rules and real release-history checks. Preserve package compatibility and
[public documentation requirements](adr/0004-public-package-documentation.md),
human dependency review and the [required CI/protection contract](main-branch-protection.md).
Scope ownership does not change package boundaries or published support.

The [owner-accepted #719 release-control design](release-controls.md) specifies approval,
candidate/artifact binding and recovery handoff for all Community distributions.
Its [dated inventory](release-controls-inventory-719.md) records actual routes and
settings separately from designed controls and unresolved access. Implementation
in #720–#722 remains separate from acceptance of this design and policy adoption.

## Consumers and upstream work

Record shared bugs and missing capabilities upstream. An affected consumer App PO
and the relevant domain/capability owner jointly decide a justified local exception
and its individual cutover plan, linking the consumer and upstream work. There is
no universal cutover deadline. Keep publication and adopted replacement evidence
separate.

Use public ecosystem packages where suitable. Shared private packages are not
permitted; application-specific identity, data and configuration remain local.
Shared public HTTP contracts remain owned by Contracts. Community does not acquire
consumer product, application tagging or Infra execution authority by publishing
a supporting package.

## Adoption status and follow-up

This document and OWNERSHIP.md establish the local role/mapping record and operating
model for [#716](https://github.com/anarchitects/anarchitecture-community/issues/716).
Project fields and active-work migration are recorded separately in the
[#717 planning migration](sdlc-planning-migration-717.md). Release permission
enforcement remains separate implementation work. The remaining work under [#715](https://github.com/anarchitects/anarchitecture-community/issues/715)
has distinct owners and acceptance gates:

- [#717](https://github.com/anarchitects/anarchitecture-community/issues/717): project schema and active-work migration.
- [#718](https://github.com/anarchitects/anarchitecture-community/issues/718): contributor intake, templates and review guidance.
- [#719](https://github.com/anarchitects/anarchitecture-community/issues/719): owner-approved release control design.
- [#720](https://github.com/anarchitects/anarchitecture-community/issues/720): version enforcement.
- [#721](https://github.com/anarchitects/anarchitecture-community/issues/721): release workflow automation.
- [#722](https://github.com/anarchitects/anarchitecture-community/issues/722): effective release permissions.
- [#723](https://github.com/anarchitects/anarchitecture-community/issues/723): detailed exception and adoption handoff.
- [#724](https://github.com/anarchitects/anarchitecture-community/issues/724): integrated verification and owner acceptance.

Existing [dependency-aware CI work #712](https://github.com/anarchitects/anarchitecture-community/issues/712)
and [packed-validation simplification #667](https://github.com/anarchitects/anarchitecture-community/issues/667)
retain their own scope and sequence. This documentation does not start them or
authorize paid CI work. Monitoring, reruns, hosted experiments and capacity changes
require explicit maintainer permission.

Reviewed on 7 November 2026 against [Meta `770b6d67`](https://github.com/anarchitects/anarchitecture-meta/tree/770b6d67d7a4479ec0226f0ac48beeb2534db6a2):
accepted ADR0016–0021 and the existing technical ADRs remain authoritative.
The confirmed package mappings introduce no identified conflict. Owner acceptance
of this local record belongs in its review; accepting it does not complete the
remaining rollout.
