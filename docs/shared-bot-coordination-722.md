# Shared bot coordination for #722

**Current status:** protected credential cutover is complete. See the
[14 November read-back](release-cutover-2026-11-14.md) for merged delivery,
successful checks, old-key retirement and remaining acceptance limits. Community
remains paused. The plan and inventory below are the earlier same-day baseline;
their pending-state statements are superseded by that read-back.

Initial status on 14 November 2026: owner-approved plan; implementation and
credential cutover in progress. This is not release authorization or Community activation.
Johan approved the following bounded plan in the working session after confirming
the App has no consumers outside the four repositories below. Existing local key
copies/custodians are uncertain; replacement and revocation resolve that uncertainty.

## Approved scope and ownership

Keep Anarchitects Bot (App `3090882`, installation `116337836`), its existing
four selected repositories and `contents: write` / `metadata: read` permissions.
Johan is accountable for the affected repository maintenance and capability
release scopes in Meta's ownership map. The App executes owner-authorized
capability releases; it gains no release authority and cannot authorize App tags.

| Repository    | Protected release environment | App identity secret          |
| ------------- | ----------------------------- | ---------------------------- |
| Community     | `community-release`           | `ANARCHITECTS_BOT_CLIENT_ID` |
| Bricks 3-tier | `shared-bot-release`          | `ANARCHITECTS_BOT_APP_ID`    |
| Contracts     | `shared-bot-release`          | `ANARCHITECTS_BOT_CLIENT_ID` |
| Plugins       | `shared-bot-release`          | `ANARCHITECTS_BOT_APP_ID`    |

Each environment must require User `vrxj81` / `5003361`, allow self-review,
disable administrator approval bypass and permit only branch `main`, with no
tag policies. The shared replacement private key belongs only in these protected
environments as `ANARCHITECTS_BOT_PRIVATE_KEY`, with a protected recovery copy
under Johan's custody. Public identity values need no secrecy, but provisioning
them alongside the key avoids reliance on the old organization allocations.

## Inventory and concrete changes

Authenticated GitHub UI inspection found two App keys, both added by `vrxj81`:

- `SHA256:X0aHdTr2AkRjrE1wXqXYZm4NlXpqmwRn8wfaiG27hHg=`
- `SHA256:6n12BK6+w53w3PfpVrQ/6qJt1Aopmmj5wrt1+PhNyOo=`

These are public fingerprints, not private keys. Organization App ID, client ID
and private-key secrets are allocated to the same four repositories. Bricks also
has a repository App ID/private-key pair; repository secrets take precedence over
organization copies. GitHub cannot return stored secret values, and none were
read or exported. Workflow inspection and organization code search identified
the four `release.yml` consumers plus Bricks' `publish.yml` relay. This bounded
inventory is not an audit of every historical workflow or unknown key copy.

Prepared changes:

- Bricks, Contracts and Plugins release jobs reference `shared-bot-release`,
  require `main` and attempt 1, and require a fresh dispatch for retries. Bricks
  and Contracts previews also request approval but do not mint App tokens.
- Bricks' release-event relay uses `GITHUB_TOKEN` with only `actions: write` to
  dispatch `publish.yml` explicitly on `main`. It has no App credential, checkout
  or OIDC. Existing manual/repository dispatch routing remains compatible.
- Contracts and Plugins check out the immutable dispatch SHA with credential
  persistence disabled, attach that exact SHA to local `main` for Nx pushes,
  and mint the App token after installation (and Contracts
  validation). Git authentication is supplied only for release execution.
  Contracts retains signed commits/tags and unchanged branch protection.
- Release jobs request only repository contents access from the App. Plugins'
  unused release OIDC permission and Nx Cloud credential are removed; Contracts
  release execution also disables Nx Cloud/DTE. No publication workflow is
  dispatched, and no package/dependency/version policy changes.

Approval trusts the complete release job, reviewed code and dependencies in the
other three repositories. Installation hooks run on the same runner as eventual
credentials; delayed token creation is not sandboxing. Bricks maintenance source
remains separately checked against its accepted routing policy. Community's
artifact-only execution boundary is not implemented in the other repositories.
Because the App key can request tokens for all installed repositories, this
shared trust remains a material limit requiring owner acceptance at cutover.

## Applied settings versus pending work

The [names-only API evidence](evidence/shared-bot-environments-2026-11-14.json)
records independent read-back. Created on 14 November with required reviewer `5003361`, self-review allowed,
custom branch policies and exactly one branch policy for `main`:

| Repository    | Environment ID | Branch-policy ID |
| ------------- | -------------- | ---------------- |
| Bricks 3-tier | `27319487005`  | `66737230`       |
| Contracts     | `27319491841`  | `66737238`       |
| Plugins       | `27319497303`  | `66737247`       |

Johan disabled administrator approval bypass and confirmed saving all three.
Subsequent independent Safari UI read-back showed the bypass checkbox off,
required reviewer `vrxj81`, self-review allowed and one main branch/no tags on
each settings page. Community's existing environment protections and pause remain intact.
No old credential allocation or App key has been removed. No replacement key has
been generated/provisioned by this work. Code is prepared locally, not deployed.

## Cutover and recovery

1. Review and merge the bounded workflow/runbook changes. Pushes, PRs, hosted CI
   and credential verification jobs need their separately required authorization.
   Bricks' human-owned commit/PR/merge policy remains in force.
2. Independently verify all four environment reviewers, branch-only policies and
   administrator-bypass settings. Confirm fresh dispatch/review behavior against
   deployed workflow code. Static tests are not hosted enforcement evidence.
3. Johan generates one replacement App key, stores its recovery copy in his
   chosen secure store, and provisions it directly into the four environments.
   Record only its public fingerprint, custodian and storage location description.
   Do not place it in chat, logs, repository files or organization/repository secrets.
   Contracts' signing key/passphrase also belong in its protected release
   environment; preserve the approved GitHub signing identity.
4. Verify replacement authentication and repository-scoped token permissions using
   separately authorized read-only credential checks. Do not run live release
   jobs as probes: those can create tags, GitHub Releases and publications.
   Confirm the recovery copy is usable without exposing it.
5. After replacement checks pass, remove the organization private-key allocations
   for all four repos and Bricks' overriding repository copy. Remove superseded
   App identity copies after their replacements are confirmed. Migrate/remove
   Contracts' unguarded signing secrets only after its protected copies are verified.
   Historical Bricks relays using the removed secret may fail; use an authorized
   manual Publish dispatch on `main` for the exact existing tag.
6. Revoke both old App keys, independently read back the remaining key inventory
   and secret names/allocations, and record Johan's acceptance of the shared
   execution trust. Keep `COMMUNITY_RELEASE_CONTROLS=paused` until the rest of
   #722 is also accepted. Never remove its main bypass blindly.

If a check fails, stop the cutover and retain the last usable protected route
until recovery is agreed. After revocation, restore access only by provisioning
an owner-controlled replacement through the protected environments. Do not
restore unguarded copies, broaden App permissions, weaken signatures/checks or
rewrite release history. npm/PyPI trust, alternate publication tokens and durable
release-evidence custody remain separately tracked in the release-permissions
runbook; this coordination does not resolve them.

## Local verification

- Bricks `release-tools:test`: 121 tests passed, no cache hits. Temporary fixture
  repositories used isolated Git configuration to avoid inheriting personal
  signing settings; repository signing requirements were not changed.
- Plugins `@anarchitecture-plugins/source:test-release-workflows`: 21 tests passed,
  no cache hits, including literal shell-input handling and rejected option input.
- Contracts `contract-checks:release-test`: 21 tests and its Nx dry-run smoke check
  passed, with all eight prerequisite tasks passing, no cache hits. The smoke
  check needed a GitHub origin URL and authenticated read-only GitHub access.
- Actionlint 1.7.12 passed Bricks release/publish and Plugins release. Contracts
  reports only its pre-existing stale action-schema errors for `client-id` on
  `actions/create-github-app-token@v3`; the upstream action manifest explicitly
  supports that input. This is not a clean Contracts actionlint result.

No hosted CI, live release, tag creation, publication or new-key verification was
performed. The above tests establish local workflow behavior and invariants,
not GitHub approval/event delivery or replacement credential usability.

## Architecture preflight

All records, including proposed/historical/superseded ADRs, were enumerated and
read before implementation: Meta 24, Community 9, Bricks 20, Contracts 5 and
Plugins 6. Base revisions:

- Meta `b2cc857bef3ecc4180ca8180db015ba5537bc497`
- Community `4235415041d602764709c4a40ddd45e2d086c2e0`
- Bricks `e8313e64b17fe98edd9470bd5169067e350d54c8`
- Contracts `fd64703f7ff2e22127e1c6e91a916ce6f8d8d6e5`
- Plugins `6842d8f7bf62e19074bc560e44d49beba0559d75`

Contributor/agent guidance, ownership/SDLC and affected release guides were read.
Meta0013 and local versioning ADRs preserve Nx authority, initial/0.x rules and
immutable history; Meta0015 keeps authorization/state outside cache/DTE;
Meta0016/0017/0019 retain owner authority and outcome acceptance. Contracts0003's
signature and compatibility obligations survive its superseded version-plan
mechanism. Bricks' accepted maintenance/compatibility decisions retain patch-only
Nest 11 routing. No accepted conflict was found; proposals do not override policy.

## References

- [Owner issue #722](https://github.com/anarchitects/anarchitecture-community/issues/722)
- [Release permissions and remaining activation blockers](release-permissions.md)
- [GitHub workflow dispatch exceptions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [App-token action inputs and default repository scope](https://github.com/actions/create-github-app-token/blob/v3/action.yml)
