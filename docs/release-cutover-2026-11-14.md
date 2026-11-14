# Release cutover read-back — 14 November 2026

Status: **credential cutover complete; Community remains paused**. This is the
current operational update for [#722](https://github.com/anarchitects/anarchitecture-community/issues/722).
It supersedes the pending-cutover statements in the earlier
[permissions inventory](release-permissions.md),
[shared bot plan](shared-bot-coordination-722.md) and
[main protection review](main-branch-protection.md). Those dated records retain
the baseline and recovery rationale. This update does not authorize activation,
release, publication or consumer adoption.

## Protected credentials and verification

The four protected-workflow PRs and four credential-verifier PRs are merged.
Johan provisioned the replacement App key in Community's `community-release` and
the other three repositories' `shared-bot-release` environments. Each requires
reviewer `vrxj81` (`5003361`), permits self-review, restricts deployment to branch
`main` and disables administrator approval bypass. Reviewer/ref settings were
read through REST; administrator bypass was independently verified in the UI.

The one remaining App key has public fingerprint
`SHA256:uAFgHxw1IaoGogEEwuvQb1+Su7p0nqjm0Gsn2Ofavco=`. Johan confirmed that he can
unlock the encrypted USB recovery copy and access the saved PEM. The four
separately authorized and owner-approved checks all passed:

| Repository    | Verification run                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Community     | [43642631991](https://github.com/anarchitects/anarchitecture-community/actions/runs/43642631991)    |
| Bricks 3-tier | [43642637728](https://github.com/anarchitects/anarchitecture-bricks-3tier/actions/runs/43642637728) |
| Contracts     | [43642643639](https://github.com/anarchitects/anarchitecture-contracts/actions/runs/43642643639)    |
| Plugins       | [43642649397](https://github.com/anarchitects/anarchitecture-plugins/actions/runs/43642649397)      |

Decoded logs confirm the same fingerprint, a token scoped to exactly the current
repository, a successful main read and automatic token revocation. These are
authentication/scope checks, not tag creation or publication tests. They preceded
old-key retirement; no additional runs were dispatched after retirement.

Independent read-back confirmed both old App keys removed, the organization
private-key secret removed and Bricks' repository private-key override removed.
Protected copies remain. Non-sensitive App ID/client ID configuration remains;
it cannot authenticate without a private key. The App still has only
`contents: write` / `metadata: read` and the same four selected repositories.

Contracts' signing identity remains
`254873688B3D6A503B23E68D9959A0F1C14F3B38`. Following merged
[PR #34](https://github.com/anarchitects/anarchitecture-contracts/pull/34),
[signing run 43644506235](https://github.com/anarchitects/anarchitecture-contracts/actions/runs/43644506235)
verified that fingerprint, signed and verified a temporary file, and removed its
temporary keyring. Repository-level signing key/passphrase copies were removed
after success; independent read-back confirmed an empty Contracts repository
secret list and all four protected environment secrets still present. No real
private-key or passphrase values were inspected by the agent.

The shared App trust boundary remains: a holder of its private key can request
tokens for any installed repository. Approval therefore trusts the reviewed
release jobs and dependencies in all four repositories. Environment approval and
delayed token creation do not sandbox installation hooks. USB accessibility is
confirmed, but independent recovery authentication and an offline GPG restoration
exercise have not been performed.

## Main and tag protection

Removed only Integration `3090882` from main ruleset `14374927`'s bypass actors.
The before-value was retained, and fresh GETs independently confirmed an empty
main bypass list and otherwise identical rule values. The effective main-rules
endpoint confirms signed commits, deletion/non-fast-forward restrictions,
squash-only PRs and the strict `main` check bound to GitHub Actions `15368`.
The existing approval count and all other review parameters are unchanged.

The replacement route was checked against current main: version preparation
writes a reviewable local diff and does not commit/push; the signed version PR
uses normal main protection. The approved controller creates only exact recorded
tags and GitHub Releases, not main commits. Protected App authentication passed,
and Johan had confirmed owner-operated manual recovery. This is source/settings
evidence supporting bypass removal, not a live release or rejected-push probe.

Both tag rulesets were read before and after and are identical. Creation still
permits only Johan `5003361` and App `3090882` for the exact 21 project prefixes;
tag update/deletion has no bypass. See the
[before/after API evidence](evidence/release-cutover-2026-11-14.json).
If execution fails, keep releases paused and review the failure or use separately
authorized recovery for the same verified bytes. Do not automatically restore
main bypass, broad credentials or released history.

## Registry and token disposition

- Community's unused repository `NPM_AUTH_TOKEN` was removed with explicit owner
  approval. Read-back lists only unrelated `ADD_TO_PROJECT_PAT` and
  `NX_CLOUD_ACCESS_TOKEN`. This removes the stored GitHub copy; it is not a claim
  that a specific underlying npm token was revoked at the registry.
- PyPI's sole publisher for `anarchitecture-dbt-governance` remains Community /
  `publish-controller.yml` / `community-publish`. Johan revoked `anarch-dbt` and
  `firstrelease`; signed-in read-back confirms an empty token inventory and two
  removal events at 21:56:24 and 21:56:52 UTC. The publisher was reopened and
  independently verified unchanged. No upload was used as proof.
- All 19 npm packages' require-2FA/disallow-bypass-token settings were previously
  saved and independently verified. The owner deferred publisher migration until
  an authorized release is ready. The eleven legacy connections remain a pending
  disposition; the `editorjs-core` connection's recorded validation deadline was
  14 November at 10:05 UTC. Do not assume it remains valid: re-read and recreate
  expired trust when preparing the authorized cutover. Never publish to preserve
  a connection. npm trust migration and installed publisher CLI/channel checks
  remain activation prerequisites.

## Durable evidence custody

Johan accepted custody of each release's records, exact package archives and
publication receipts, copying them before GitHub expiry to both:

- Primary: encrypted USB named **Anarchitects**.
- Second backup: **Asustor Lockerstor AS6604T**.

Keep record/archive digests, source run and artifact IDs, candidate/controller
revisions, approvals and complete or partial receipts together. Preserve them
through publication and recovery. Verify copied bytes against the recorded
digests before relying on them. This records the agreed custody process; it does
not assert that the NAS is encrypted, that a backup job exists, or that copies
and restoration have already been tested. Key recovery is a separate custody
concern; do not place private credentials in release-evidence bundles.

Signed-in Actions settings read-back shows **90 days**, with an organization
maximum of **90 days**, matching the release workflows' requested retention.
A paginated artifact inventory contained no retained release-record or receipt
artifacts to copy during this review. Future artifacts' actual expiry remains
authoritative. External copies are recovery evidence, not alternate controller
inputs: expired/missing GitHub artifacts still require a new trusted record and
review, or separately authorized manual recovery.

## Remaining acceptance and maintenance

`COMMUNITY_RELEASE_CONTROLS=paused` was freshly verified. The legacy Community
workflow cleanup is merged; its old merge prerequisite is resolved. Remaining
work includes the deferred npm trust cutover, any unresolved alternate-access
scope, final review of effective settings and this runbook, and explicit owner
acceptance before activation. A future release also needs its own candidate,
evidence and authorization; #722 does not resolve package-history or renderer
readiness issues. Keep #712/#667 and #715's policy adoption distinct.

Repeat the relevant read-back after changes to owners, App installations/keys,
protected workflows, secrets, registry trust/tokens, rules/check identities,
retention or evidence custody. Prior offline rejection tests and live settings
are distinct from hosted enforcement evidence. No release, publication, tag,
push-denial experiment or CI run was started for this reconciliation.

The earlier complete preflight remains applicable to this #722 settings/docs
scope: all 24 Meta ADRs at `b2cc857bef3ecc4180ca8180db015ba5537bc497` and all nine
Community ADRs. Meta main still matches that revision; Community ADRs are
unchanged from the reviewed #730 baseline. Meta0013/Community0007 preserve Nx
version authority and immutable history; Meta0015 keeps authorization/state
fresh; Meta0016/0017/0019 retain owner authority and outcome acceptance;
Community0004 places this evidence in contributor docs. No new implementation or
policy exception is introduced; proposals retain their status.
