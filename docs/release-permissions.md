# Release permissions and cutover (#722)

Status: **in progress; activation blocked**. This record applies the
[owner-accepted design](release-controls.md) to the
[#721 implementation](release-execution.md). It does not authorize a release or
claim that the staged controllers are operational. Johan (`vrxj81`, ID `5003361`)
is the confirmed owner for all 21 release projects. The bot executes approved
capability releases; it cannot authorize them. Community's fixture applications
are excluded from the release inventory.

## Current versus proposed settings

The [dated API snapshot](evidence/release-permissions-2026-11-12.json) records the
12 November 2026 baseline at `f74a204` (#730), subsequent writes and independent
read-back. Secret values are neither requested nor retained. The #719 inventory
remains historical evidence, not a current administrative audit.

| Surface                            | Observed baseline                                                                                                                                       | Required disposition                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main ruleset `14374927`            | Active; strict `main` check from GitHub Actions `15368`, signed commits, squash-only PRs, deletion/force-push restrictions; no inherited rules returned | Preserve all these controls and the current approval count. No CI contract change.                                                                                                                                                       |
| Bot main bypass                    | Integration `3090882`, `always`                                                                                                                         | Remove only during the agreed cutover after the version-PR/manual recovery route is verified. No new bypass actor.                                                                                                                       |
| Repository squash defaults         | `COMMIT_OR_PR_TITLE` / `COMMIT_MESSAGES`                                                                                                                | Set `PR_TITLE` / `PR_BODY` to match #720's validated prospective message. Defaults do not prevent a maintainer editing the final message.                                                                                                |
| Default workflow token             | `write`; PR approval disabled                                                                                                                           | Set `read`; retain PR approval disabled. All five current workflows declare explicit permissions. The forwarder alone requests `actions: write`; the approved publisher alone should request OIDC.                                       |
| Approval environments              | None                                                                                                                                                    | Create `community-release` and `community-publish`: reviewer User `5003361` only, self-review allowed, admin approval bypass disabled, custom branch policy `main` of type `branch`, no tag policies. Main remains protected separately. |
| Release-tag rules                  | None                                                                                                                                                    | Separate creation and history rulesets for the exact 21 project patterns below. Creation bypass only User `5003361` and Integration `3090882`; update/deletion bypass empty.                                                             |
| Bot installation `116337836`       | App `3090882`; Community, Bricks 3-tier, Contracts and Plugins selected; `contents: write`, `metadata: read`; authenticated UI read-back                | Retain this minimum permission grant and the other repositories' authorized allocations. The job token is restricted to its current repository.                                                                                          |
| App credential allocation          | Organization `ANARCHITECTS_BOT_APP_ID`, `ANARCHITECTS_BOT_CLIENT_ID` and `ANARCHITECTS_BOT_PRIVATE_KEY` each allocated to the same four repositories    | Owner provisions the client ID/key in `community-release` without exposing values. Remove only Community's allocation of the three unguarded organization secrets after confirming the replacement; preserve the other consumers.        |
| Repository secret `NPM_AUTH_TOKEN` | Exists; no reference in current workflows                                                                                                               | Verify scope/consumers and revoke or remove the Community publication bypass during cutover. Absence from current YAML does not neutralize historical workflows.                                                                         |
| Other repository secrets           | `ADD_TO_PROJECT_PAT`, `NX_CLOUD_ACCESS_TOKEN`                                                                                                           | Preserve unrelated operation. Establish whether any inherited/token path can bypass release controls; names alone do not prove token scope.                                                                                              |
| npm publishers (19 packages)       | All inspected through authenticated UI: 11 trust `publish.yml` without an environment; eight authoring packages have no publisher                       | Bind each to `anarchitects/anarchitecture-community`, `publish-controller.yml`, `community-publish`. Replace the 11 old connections and create the missing eight.                                                                        |
| npm publishing access              | All 19 allow 2FA **or** a granular token with bypass 2FA; sole displayed maintainer `vrxj81` via `developers`                                           | Set each to require 2FA and disallow bypass tokens; retain owner access. Inventory/revoke superseded automation tokens without exposing values.                                                                                          |
| PyPI host                          | One GitHub publisher: Community, `publish.yml`, any environment; sole Owner `anarchitects` (Johan Vrolix), 2FA enabled                                  | Replace trust with `publish-controller.yml` / `community-publish`; preserve owner recovery and verify uv mandatory OIDC.                                                                                                                 |
| Registry account tokens            | npm shows two expired tokens and no active tokens. PyPI shows one project-scoped token and one all-project bootstrap token                              | Do not infer a GitHub secret's contents from this list. Confirm owner's local recovery custody; disposition the broad PyPI bootstrap token and remove automated credential paths during cutover.                                         |
| Activation variable                | `COMMUNITY_RELEASE_CONTROLS` absent; deployed #721 still has legacy jobs                                                                                | Set a nonempty pause value in the agreed window. Merge the legacy-removal change only as part of that cutover. Set `active` only after complete read-back and owner acceptance.                                                          |
| Artifact retention                 | Workflows request 90 days                                                                                                                               | Verify effective retention and agree the owner's durable evidence store and custody. Preserve records/archives/receipts before expiry; backups are not alternate controller inputs.                                                      |

The workflow-token default and squash-message defaults were **applied and
independently read back** on 12 November. They required no credential/trust
migration and dispatched no work. Their original values above are the recovery reference; if an
unexpected workflow needs write access, review its explicit minimal permission
instead of broadly restoring write access. Keep all ruleset safeguards intact.

### Exact tag scope and actors

For each name below, both proposed rulesets include `refs/tags/<name>@*`, with no
exclusions. This is a project-prefix protection boundary; the controller enforces
the exact version/tag identity and owner approval. It is not a SemVer validator.

```text
better-auth-typeorm-adapter
nest-angular-ssr
governance-core
governance-adapter-dbt
governance-adapter-typescript
governance-extension-dbt
governance-extension-typescript
governance-dbt-package
governance-runtime-dbt
governance-cli
governance-host-dbt
editorjs-core
editorjs-angular
editorjs-tool-paragraph
editorjs-tool-header
editorjs-tool-list
editorjs-tool-quote
editorjs-tool-image
editorjs-upload-fetch
editorjs-html
editorjs-html-angular
```

`community-release-tag-creation`: target `tag`, enforcement `active`, rule
`creation`, bypass actors `{actor_type: User, actor_id: 5003361, bypass_mode: always}`
and `{actor_type: Integration, actor_id: 3090882, bypass_mode: always}`.
Use the numeric App ID, not its installation ID. Individual user bypass is now
[supported by GitHub](https://github.blog/changelog/2026-05-07-repository-rulesets-user-bypass-and-branch-renaming/),
so no new owner team or broad administrator role is needed.

`community-release-tag-history`: same scope, target and enforcement, rules
`update` (with `update_allows_fetch_and_merge: false`) and `deletion`, with
**no bypass actors**. Creation permission must never become history-rewrite
permission. See the [repository rules API](https://docs.github.com/en/rest/repos/rules).
No temporary tag is created or pushed to test these settings.

All names except `governance-host-dbt` and `governance-dbt-package` identify npm
packages `@anarchitects/<name>`; those 19 settings must each be read back. dbt
distribution uses the protected Git tag/subdirectory, not a registry publisher.

The eight npm packages without a trusted publisher are `editorjs-core`,
`editorjs-angular`, all five `editorjs-tool-*` projects and `editorjs-upload-fetch`.
The other eleven each have one valid connection, direct publish enabled, no
environment and dist-tag management disabled. npm reports staged publishing as
always allowed by that connection; this does not adopt staged publishing as a
Community route. The current UI makes the repository/workflow binding immutable,
so replacement requires creating the intended connection and deleting the old one
during cutover. No registry settings were changed by this inventory.

## Cutover sequence and recovery

The accepted design requires an owner-agreed maintenance window and usable manual
recovery before changing production credentials/trust. These are **pending**,
not inferred from starting #722 or accepting #719's design.

1. Complete missing administrative inventory, including organization secret
   allocations, App repository selection, registry collaborators/publishers/tokens,
   environment admin-bypass availability and durable evidence custody. The REST
   environment endpoint documents reviewer/ref settings, but does not document
   the admin-bypass switch; configure/read it through a supported administrative
   surface. Do not assume an undocumented request field worked.
2. Agree the bounded window. Confirm the owner can authenticate locally and recover
   the exact reviewed archives, without test publication. Preserve before-values
   and unfinished release evidence. Pause new mutation requests and reconcile or
   cancel existing legacy executions/approvals within separately authorized scope.
3. Configure both environments and their exact branch policies; verify both before
   provisioning environment secrets. Never fetch/decrypt secret values to move
   them. The owner provisions through the authenticated secret UI/CLI locally.
   Remove overlapping Community access only after the protected replacement and
   manual route are confirmed; do not revoke a shared key across other repositories
   without coordinating its consumers.
4. Configure tag creation/history rules and registry trust together. Remove old
   `publish.yml`/environment-free trust and alternate automated token routes.
   Historical tags contain historical workflow code; deleting the latest legacy
   job does not revoke that authority. Verify npm provenance, installed publisher
   CLI support and PyPI OIDC. Channel use additionally requires npm's **Allow npm
   dist-tag** opt-in and the controller's npm >=11.21.0 floor. Local npm 11.19.1
   is not evidence for hosted CLI support. Do not add staged publishing implicitly.
5. Merge the reviewed workflow cleanup during the window. It removes legacy Nx
   release/build/publication jobs and arbitrary version inputs. All remaining
   mutation entry points require `COMMUNITY_RELEASE_CONTROLS=active`; unset or
   paused can no longer restore the legacy route. Preserve the protected main
   controllers, per-run reviews and fresh-dispatch retry behavior. Remove only
   the bot's main bypass after the replacement route is verified.
6. Independently read effective settings again, including parent rules, selected
   repositories and every publisher. Record allowed/rejected-path evidence and
   residual limits below. Owner acceptance precedes `active`; green CI or a merged
   PR alone is insufficient.

If cutover fails, keep releases paused and use separately owner-authorized manual
recovery for the same verified bytes, or wait for the blocker. Do not unset the
variable on an old revision, reinstall broad credentials/trust or restore bot main
bypass as automatic rollback. Never rewrite released tags/versions. Preserve
partial receipts and revalidate before a fresh owner-approved dispatch.

## Verification and open blockers

| Path                                                                                                                             | Required result and evidence                                           | Current evidence                                                       |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Current main controller, valid record and owner review                                                                           | Permit only the recorded operations                                    | Local controller tests; live environment/trust proof pending           |
| Missing/non-owner approval, foreign/expired artifact, changed controller, failed exact-candidate CI, conflicting published bytes | Stop before mutation                                                   | Existing offline negative tests; not a hosted enforcement claim        |
| Non-main ref or reused run attempt                                                                                               | Reject privileged controller                                           | Workflow guard and controller tests; environment ref read-back pending |
| Legacy build/publish job or unset activation variable                                                                            | No privileged fallback after cleanup                                   | Local workflow contract test; cleanup not yet merged                   |
| Owner or bot creates a matching capability tag                                                                                   | Creation rule permits execution; owner authorization remains mandatory | Proposed rule only; read-back pending                                  |
| Other actor creates, or any actor updates/deletes matching release tag                                                           | Block; no blanket admin/history bypass                                 | Proposed rule only; read-back pending                                  |
| Old tag workflow requests registry access                                                                                        | No matching publisher/token path                                       | Blocked on registry/secret inventory and cutover                       |
| Required `main` check and signed history                                                                                         | Preserve #696/#720 contract                                            | Fresh live settings and unchanged CI workflow; no CI-result inspection |

GitHub CLI repository administration is available. The CLI's organization reads
returned 403 and npm trust inspection returned 401, but restored Safari access
resolved the bot installation, secret allocation and all 19 npm package settings.
After local owner sign-in, PyPI publisher, collaborator/2FA and token-scope metadata
were also read. Both npm and PyPI settings are administratively accessible.
Token disposition, protected credential provisioning, environment controls,
manual recovery and evidence custody remain unresolved. These are activation
blockers, not proof that the underlying controls are absent.

Local `test-release-policy` and `validate-release-policy` passed with Nx Cloud
disabled and no cache hits. Workflow regression coverage rejects the removed
legacy jobs, missing required record inputs and unguarded App/OIDC privileges.
Local links and exact coverage of all 21 tag patterns/19 npm entries were checked.
The available actionlint 1.7.12 reports only its existing schema gaps for
`concurrency.queue` and `actions/create-github-app-token@v3`'s `client-id`; these
unchanged features were verified against upstream documentation in #721. This
does not constitute a clean actionlint run or hosted enforcement evidence.

No CI monitoring, reruns, hosted experiments, workflow dispatches, publication,
tagging or secret-value inspection is included in this work. Any hosted proof needs
its own permission. Package history discrepancies and renderer G07 remain as
recorded in the existing release guides; #712 and #667 stay separate.

## Maintenance and architecture

Reconcile this record after changes to owners, release project inventory, App
installation/keys, registry access/trust, workflow identities/permissions, branch
or tag rules, token defaults, retention, required CI checks or controller tooling.
Date new observations and keep previous evidence distinguishable. Do not close
#722 on a code-only result: its promised result includes effective settings and
owner acceptance.

The 12 November preflight enumerated and read every Meta ADR (24 records, all
statuses, at `b2cc857bef3ecc4180ca8180db015ba5537bc497`) and every Community ADR
(nine records at `f74a204`), plus CONTRIBUTING, OWNERSHIP, SDLC and the affected
release/protection guides. Meta0013/Community0007 retain independent Nx versions,
0.x behavior and immutable history; Meta0015 keeps fresh authorization/state
outside cache/DTE; Meta0016/0017/0019 govern owner authority and accepted outcomes.
Community0004 keeps this operational record outside package READMEs. No accepted
decision conflicts with the settings proposal; proposals do not override policy.
