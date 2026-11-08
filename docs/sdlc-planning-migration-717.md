# Community planning migration (#717)

Migration prepared and applied on 7 November 2026; workflow correction completed
and independently verified on 8 November 2026. Reviewed against Meta `770b6d67d7a4479ec0226f0ac48beeb2534db6a2`
and Community `aa406623ce97f12acb2993abcd055fe4e969885b`.

This record covers the live [Community project #16](https://github.com/orgs/anarchitects/projects/16)
and selected Community links in the existing [organization overview #26](https://github.com/orgs/anarchitects/projects/26).
The canonical [SDLC](https://github.com/anarchitects/anarchitecture-meta/blob/main/docs/sdlc.md#planning-structure)
owns the meanings; [OWNERSHIP.md](../OWNERSHIP.md) owns the local package mapping.

## Decision review and boundaries

All 24 Meta and nine local ADRs were enumerated and reviewed for this scope.
Meta0016 separates accountable ownership from maintainership; Meta0019 requires
repository execution projects, one organization overview and acceptance-based
Done. Meta0017 preserves capability release autonomy and owner authorization.
Meta0018 preserves separate upstream/publication/adoption outcomes. Meta0013 and
Community0007 remain the release-versioning authority; Meta0015's CI/cache/DTE
requirements and owned exceptions remain intact. Governance proposals remain
proposals. No conflicting accepted decision was identified.

This migration does not implement a Governance package, synchronization service,
release workflow or compatibility change. Public-package READMEs stay consumer
focused under Community0004; planning operations are documented here.

## Inventory and mapping prepared before mutation

Project #16 contained 406 items: 383 issues and 23 historical pull requests.
All 51 open Community issues were already present, so none needed importing.
The other 355 items were marked Done. There were 19 fields, six saved views and
seven enabled built-in workflows. Project #26 contained 42 selected outcomes,
23 fields and six views; eight rows referred to Community issues.

Full before exports, issue states/parent/subissue relationships, the prepared
mapping, mutation responses and after exports are retained locally under
`tmp/sdlc-717/` (gitignored). They include private project configuration and are
not published wholesale in this repository. Johan retains this recovery bundle
in access-controlled storage before cleaning the workspace. The evidence manifest
below records checksums so a retained copy can be verified.

| Surface           | Mapping                                                              | Preservation                                                                  |
| ----------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Status            | Backlog, Ready, In Progress, In Review, Blocked, Done, Cancelled     | Existing five option IDs retained; two added                                  |
| Priority          | P0–P3 with canonical descriptions                                    | Existing P0–P2 IDs and every item priority retained                           |
| Domain/Capability | New text field containing confirmed functional scope                 | No package boundary or new product authority inferred                         |
| Owner             | New text field: Johan for the reviewed Community work                | Assignees remain separate and unchanged                                       |
| Target release    | New text field, initially unset                                      | Target date remains separate and unchanged                                    |
| Blocked by        | New text field with concrete prerequisite issue URLs                 | Parent/subissue links remain unchanged                                        |
| Iteration         | Two 14-day periods beginning 16 and 30 November 2026                 | All eight historical periods, IDs and assignments retained; no new assignment |
| Local fields      | Retain Size, Estimate, Start date, Target date and built-in metadata | No field deleted or repurposed                                                |

The Status IDs retained are Backlog `f75ad846`, Ready `08afe404`, In Progress
`47fc9ee4`, In Review `4cc61d42` and Done `98236657`. New options are Blocked
`020a14e6` and Cancelled `3d26178c`. P3 is `dfb08f8f`. The shared-calendar periods
are `73660ffd` (16 November) and `9c3daa58` (30 November); these IDs are local to
Project #16 and are not the matching Project #26 iteration IDs.

## Reviewed active-work set

The reviewed set is every open Community issue at export: exactly the 51 rows
below. Johan is the accountable owner for this set under #716's capability and
repository-maintainer assignments. `Community repository maintenance` describes
cross-package technical work, not an invented capability or release role.
Historical closed work is retained as history, not freshly re-accepted.

Status changes are deliberately narrow: #651 is In Review because its upstream
PR was submitted and response handling remains open; six Ready SDLC slices become
Blocked because their recorded prerequisites are still open. #719 remains Ready
because #716 is accepted. Existing Backlog and In Progress values otherwise remain.
This is a planning migration, not a fresh implementation audit of every older epic.
After the initial mapping read-back, #717 was temporarily Blocked on UI access.
That blocker was resolved on 8 November; the completed result is now In Review
for owner acceptance, with no remaining Blocked by value.

| Issue                                                                       | Functional scope                 | Resulting status | Unresolved prerequisite                  |
| --------------------------------------------------------------------------- | -------------------------------- | ---------------- | ---------------------------------------- |
| [#33](https://github.com/anarchitects/anarchitecture-community/issues/33)   | SSR in Community                 | Backlog          | —                                        |
| [#34](https://github.com/anarchitects/anarchitecture-community/issues/34)   | SSR in Community                 | Backlog          | —                                        |
| [#36](https://github.com/anarchitects/anarchitecture-community/issues/36)   | SSR in Community                 | Backlog          | —                                        |
| [#37](https://github.com/anarchitects/anarchitecture-community/issues/37)   | SSR in Community                 | Backlog          | —                                        |
| [#38](https://github.com/anarchitects/anarchitecture-community/issues/38)   | SSR in Community                 | Backlog          | —                                        |
| [#39](https://github.com/anarchitects/anarchitecture-community/issues/39)   | SSR in Community                 | Backlog          | —                                        |
| [#40](https://github.com/anarchitects/anarchitecture-community/issues/40)   | SSR in Community                 | Backlog          | —                                        |
| [#41](https://github.com/anarchitects/anarchitecture-community/issues/41)   | SSR in Community                 | Backlog          | —                                        |
| [#42](https://github.com/anarchitects/anarchitecture-community/issues/42)   | SSR in Community                 | Backlog          | —                                        |
| [#43](https://github.com/anarchitects/anarchitecture-community/issues/43)   | SSR in Community                 | Backlog          | —                                        |
| [#54](https://github.com/anarchitects/anarchitecture-community/issues/54)   | Auth                             | In Progress      | —                                        |
| [#55](https://github.com/anarchitects/anarchitecture-community/issues/55)   | Auth                             | Backlog          | —                                        |
| [#58](https://github.com/anarchitects/anarchitecture-community/issues/58)   | Auth                             | Backlog          | —                                        |
| [#59](https://github.com/anarchitects/anarchitecture-community/issues/59)   | Auth                             | Backlog          | —                                        |
| [#60](https://github.com/anarchitects/anarchitecture-community/issues/60)   | Auth                             | Backlog          | —                                        |
| [#61](https://github.com/anarchitects/anarchitecture-community/issues/61)   | Auth                             | Backlog          | —                                        |
| [#62](https://github.com/anarchitects/anarchitecture-community/issues/62)   | Auth                             | Backlog          | —                                        |
| [#63](https://github.com/anarchitects/anarchitecture-community/issues/63)   | Auth                             | Backlog          | —                                        |
| [#64](https://github.com/anarchitects/anarchitecture-community/issues/64)   | Auth                             | Backlog          | —                                        |
| [#65](https://github.com/anarchitects/anarchitecture-community/issues/65)   | Auth                             | Backlog          | —                                        |
| [#77](https://github.com/anarchitects/anarchitecture-community/issues/77)   | Visual Composition in Community  | Backlog          | —                                        |
| [#78](https://github.com/anarchitects/anarchitecture-community/issues/78)   | Visual Composition in Community  | Backlog          | —                                        |
| [#133](https://github.com/anarchitects/anarchitecture-community/issues/133) | Governance in Community          | Backlog          | —                                        |
| [#135](https://github.com/anarchitects/anarchitecture-community/issues/135) | Governance in Community          | Backlog          | —                                        |
| [#136](https://github.com/anarchitects/anarchitecture-community/issues/136) | Governance in Community          | Backlog          | —                                        |
| [#138](https://github.com/anarchitects/anarchitecture-community/issues/138) | Governance in Community          | Backlog          | —                                        |
| [#139](https://github.com/anarchitects/anarchitecture-community/issues/139) | Governance in Community          | Backlog          | —                                        |
| [#140](https://github.com/anarchitects/anarchitecture-community/issues/140) | Governance in Community          | Backlog          | —                                        |
| [#141](https://github.com/anarchitects/anarchitecture-community/issues/141) | Governance in Community          | Backlog          | —                                        |
| [#142](https://github.com/anarchitects/anarchitecture-community/issues/142) | Governance in Community          | Backlog          | —                                        |
| [#300](https://github.com/anarchitects/anarchitecture-community/issues/300) | Governance in Community          | Backlog          | —                                        |
| [#316](https://github.com/anarchitects/anarchitecture-community/issues/316) | Governance in Community          | Backlog          | —                                        |
| [#317](https://github.com/anarchitects/anarchitecture-community/issues/317) | Governance in Community          | Backlog          | —                                        |
| [#318](https://github.com/anarchitects/anarchitecture-community/issues/318) | Governance in Community          | Backlog          | —                                        |
| [#469](https://github.com/anarchitects/anarchitecture-community/issues/469) | Governance in Community          | Backlog          | —                                        |
| [#517](https://github.com/anarchitects/anarchitecture-community/issues/517) | Visual Composition in Community  | Backlog          | —                                        |
| [#543](https://github.com/anarchitects/anarchitecture-community/issues/543) | Community repository maintenance | Backlog          | —                                        |
| [#578](https://github.com/anarchitects/anarchitecture-community/issues/578) | SSR in Community                 | Backlog          | —                                        |
| [#650](https://github.com/anarchitects/anarchitecture-community/issues/650) | Visual Composition in Community  | In Progress      | —                                        |
| [#651](https://github.com/anarchitects/anarchitecture-community/issues/651) | Visual Composition in Community  | In Review        | —                                        |
| [#667](https://github.com/anarchitects/anarchitecture-community/issues/667) | Visual Composition in Community  | Backlog          | —                                        |
| [#712](https://github.com/anarchitects/anarchitecture-community/issues/712) | Community repository maintenance | Backlog          | —                                        |
| [#715](https://github.com/anarchitects/anarchitecture-community/issues/715) | Community repository maintenance | In Progress      | —                                        |
| [#717](https://github.com/anarchitects/anarchitecture-community/issues/717) | Community repository maintenance | In Review        | —                                        |
| [#718](https://github.com/anarchitects/anarchitecture-community/issues/718) | Community repository maintenance | Blocked          | #717                                     |
| [#719](https://github.com/anarchitects/anarchitecture-community/issues/719) | Community repository maintenance | Ready            | —                                        |
| [#720](https://github.com/anarchitects/anarchitecture-community/issues/720) | Community repository maintenance | Blocked          | #719                                     |
| [#721](https://github.com/anarchitects/anarchitecture-community/issues/721) | Community repository maintenance | Blocked          | #719, #720                               |
| [#722](https://github.com/anarchitects/anarchitecture-community/issues/722) | Community repository maintenance | Blocked          | #721                                     |
| [#723](https://github.com/anarchitects/anarchitecture-community/issues/723) | Community repository maintenance | Blocked          | #717, #718, #719                         |
| [#724](https://github.com/anarchitects/anarchitecture-community/issues/724) | Community repository maintenance | Blocked          | #717, #718, #719, #720, #721, #722, #723 |

All 51 work items have an ownership/scope mapping. Forty-seven have no recorded
local Priority; these remain unset for Johan's triage. No release, new iteration
assignment or date is invented. In particular, #33's March iteration is preserved
as historical planning, not treated as a current commitment. #578's separate
Project #23 P0 entry does not silently overwrite its unset Project #16 priority.
Owners reconcile differences during planning rather than copying portfolio values.

#145 is the single historical status correction: GitHub records CLOSED /
NOT_PLANNED, so its project status changes from Done to Cancelled. Its original
closure, reason and issue history remain. The other 354 historical Done items are
unchanged; this migration does not certify their publication or consumer adoption.

## Views and workflows

The six existing views retain their identities and layouts. Prioritized backlog
now filters `-status:Done -status:Cancelled` and shows Domain/Capability, Owner,
Target release and Blocked by alongside its existing fields. In Review has the
canonical name and `status:"In Review"` filter. Status board, Roadmap, Bugs and
My items retain their configuration. No useful local view is deleted.

Before changes, the native UI confirmed these workflow rules:

| Workflow            | Before                                | Result and reason                                                                    |
| ------------------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| Auto-add sub-issues | Enabled                               | Retain; preserve repository execution relationships                                  |
| Auto-add to project | Enabled, Community `is:issue is:open` | Retain; no organization-wide import                                                  |
| Item added          | Enabled, issue/PR → Backlog           | Retain; new items need classification                                                |
| Pull request linked | Enabled, linked issue → In review     | Retain In Review as a review cue, not acceptance; owner corrects draft/partial cases |
| Auto-close issue    | Enabled, Done → close                 | Retain; follows the explicit acceptance action, not its substitute                   |
| Item closed         | Enabled, issue/PR → Done              | Disabled; closed-not-planned and unaccepted outcomes must not become Done            |
| Pull request merged | Enabled, PR → Done                    | Disabled; merge alone is not outcome acceptance                                      |

**Verified on 8 November 2026:** Item closed and Pull request merged are disabled.
The native UI showed both switches off and five workflows enabled. Independent
GraphQL read-back confirmed both `enabled: false` values, all seven original
workflow IDs, and the other five workflows still enabled. No rule was deleted.
The previously recorded Safari-access blocker is resolved. The same read-back
confirmed fields and saved views remain identical to the 7 November migration.

The four other UI defaults (auto-archive, code-changes-requested, code-review-approved
and item-reopened) had no enabled persisted workflow at export. Project #26 already
keeps only its item-added workflow enabled; its schema, views and automations are
preserved.

Record owner acceptance in the issue/PR before setting Done. Use Cancelled for a
deliberate stop, retaining the reason. A linked PR can be partial or draft: its
In Review cue does not waive issue-level acceptance. Resolve Blocked by links
explicitly when prerequisites are accepted; do not automatically promote work to
Ready or start it. A publication/adoption promise stays open until that promised
result is accepted, even when an implementation PR has merged.

## Organization overview and reconciliation

Project #26 retains its existing selection. Only parent #715 is added; its eight
remaining implementation children are not imported. The eight existing Community
rows (#55, #61, #62, #63, #77, #667, #679, #695) receive confirmed scope and Johan
ownership. Existing priorities are preserved, including differences from #16.
#679 changes from stale Backlog/Delivery to Done/Baseline, linked to its completed
issue and #706/#707 evidence. This does not claim renderer remote restoration or
actual DTE: the accepted G07 exception remains owned by the renderer/CI maintainers,
with revisit required before advertising that support. See the
[integrated stability review](editorjs-integrated-stability-review.md).

Johan reconciles Community's source and overview links, statuses, blockers and
evidence at planning and acceptance changes. PWG remains the ecosystem SDLC owner
for overview policy; competing priorities require the affected owners' agreement.
The existing overview README retains that responsibility split. Identical field
names and shared issue identity do not synchronize custom field values.

## Verification and recovery

Read-back checks passed for the exact canonical schema, retained option and
historical iteration IDs, all 51 active mappings, six views, and all 406 original
item identities.
All original item fields except the documented status changes and newly populated
fields remain identical. All 383 source issue states and parent/subissue relationships were independently
read back unchanged; no relationship or issue-close mutation was performed.
Project #26 read-back confirms its eight reconciled rows, only one new parent row
(42 → 43), and all 34 non-Community rows and the complete exported configuration
unchanged. Its six views and item-added workflow remain intact.

The final workflow read-back passed. #717 remains In Review until the owner
accepts the completed migration and its repository record.
No runtime build/test suite or hosted CI inspection is needed for this planning
change. Documentation formatting, relative links and `git diff --check` passed.
The final workflow snapshot is retained as
`tmp/sdlc-717/config16-final-2026-11-08.json`.

Recovery is a reconciliation against the retained before exports, not a blind
bulk reset:

1. Stop and compare current values with the mutation journal; preserve any later
   owner changes. Restore only values changed by this migration using the original
   project/item/field IDs. Clear newly populated fields where the before value was
   empty; do not delete items or alter source issue state/relationships.
2. Restore prior view filters/visible fields and project README from the before
   configuration. Existing status and priority IDs allow names/descriptions to be
   restored without recreating fields. Keep new options if later items use them;
   migrate such values deliberately before considering removal.
3. Retain the eight historical iteration records unchanged. New calendar periods
   were unassigned; check for subsequent assignments before changing them. Never
   reinterpret a historical period as a new sprint.
4. For Project #26, restore only the eight Community rows' changed values and
   reconcile/remove the newly added #715 row if appropriate. Do not reset other
   repositories' metadata or the overview's existing schema/views/workflows.
5. Re-enable the two workflow switches only through a deliberate maintainer
   decision after considering their acceptance hazard; preserve their original
   rule definitions for recovery. Re-read schema, items, views and workflow state
   after any restoration.

Keep `tmp/sdlc-717/` until owner acceptance and a retained backup are confirmed.
A repository merge does not itself reverse or apply GitHub Project changes.

## Before-export checksums

SHA-256 values for the local recovery bundle; raw private-project exports remain
access-controlled and outside Git.

| File in `tmp/sdlc-717/`    | SHA-256                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `717-config16-before.json` | `1d41b21ca2afb8e522784d70a795ada13aae63226736483f8963ae121ade2c4f` |
| `717-items16-before.json`  | `f7c06f80707a0aff484e5ebcb0108c8cde8ad805a182a348cd6faa7f38819851` |
| `717-config26-before.json` | `79f172b5aea15178483b4e5b2560ec23bdcaa015b5130955de079332546e2f4a` |
| `717-items26-before.json`  | `c5ccbbfec2ee4195cb88389aab7b6ead7a40f86bc18c98a3b5960116db6376ed` |
| `717-issues-before.json`   | `ce5e3b5e6dba430d032822d7582b1edff5fc8b86af69f589387f181328b68535` |
| `717-plan.json`            | `2f7af206a39cd915ac06006d1365d56879784a515f508641e9a76625e3abedd3` |
