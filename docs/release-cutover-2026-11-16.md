# Release cutover completion review — 16 November 2026

Status: **settings reconciliation complete; owner review of this record pending**.
This updates [#722](https://github.com/anarchitects/anarchitecture-community/issues/722)
and supersedes the pending settings in the [14 November record](release-cutover-2026-11-14.md).
Johan requested the closure review after removing the last two legacy npm publishers.
Controls are **paused**, independently read back after the authorized SSR releases.
Completion of this cutover does not activate releases or authorize another package,
version, channel change, hosted run or consumer deployment.

## Final settings and registry disposition

- Signed-in npm read-back confirms **no trusted publisher** on
  `@anarchitects/better-auth-typeorm-adapter` and
  `@anarchitects/editorjs-html-angular`. Both retain require-2FA/disallow-bypass-token
  access. Johan performed these last two removals after the earlier npm UI errors.
  Together with the eight removals and SSR replacement recorded in #722 earlier
  today, all eleven recorded legacy `publish.yml` bindings are retired. This is a
  consolidated dated inventory, not a fresh revisit of every package in this review.
- SSR has exactly one **Valid** publisher: `anarchitects/anarchitecture-community`,
  `publish-controller.yml`, environment `community-publish`. Direct npm publication
  is allowed; separate `npm dist-tag` permission is absent. Require-2FA and
  disallow-bypass-token access remain selected. Actual protected OIDC uploads are
  recorded below. Packages without a release candidate remain unconfigured under
  Johan's accepted just-in-time onboarding decision; do not create expiring trust
  or publish merely to validate a connection.
- PyPI's protected publisher and empty API-token inventory were independently
  verified on 14 November. They were not re-audited today and no PyPI upload is
  claimed. Its next real release must verify its own toolchain and OIDC exchange.
- Both Community environments still require owner `5003361`, allow self-review,
  disable administrator bypass and allow only branch `main`. The release
  environment has the App client ID/private key; publishing has no stored secrets.
  Repository secrets contain only `NX_CLOUD_ACCESS_TOKEN`; deploy keys are empty.
- Fresh signed-in organization read-back lists only `ANARCHITECTS_BOT_APP_ID`,
  `ANARCHITECTS_BOT_CLIENT_ID` and `HETZNER_DEPLOY_HOST`. The shared private-key
  secret remains absent. This resolves the current CLI's organization-listing
  403 through UI metadata inspection, without widening access or reading values.
  The earlier four-repository credential/signing verification, old-key retirement
  and encrypted USB recovery custody remain the dated evidence in the prior record.
- Main and maintenance protections match the accepted snapshots: no bypass,
  signed commits, protected history and strict `main`/GitHub Actions `15368` checks.
  Tag creation retains only owner `5003361` and App `3090882`; tag update/deletion
  has no bypass. Default workflow permissions remain read/no PR approval. No
  protection, owner mapping or credential scope was weakened for these releases.

The current/proposed settings difference is now **none** for the accepted cutover
scope. The legacy-workflow cleanup and bot-main-bypass removal are complete.
Future package onboarding and channel permission checks are per-release gates,
not permission to restore environment-free trust. Owner/manual recovery remains
available under the existing exact-byte recovery procedure.

## Protected execution evidence

Both executions were real owner-authorized SSR releases, not publication probes.
Johan explicitly accepted a temporary repository-wide activation exception while
the last two unrelated bindings were unresolved; each exception ended with a
verified return to paused. Both release and publishing approvals were recorded
by GitHub for `vrxj81` / `5003361`.

| Evidence                 | Nest 11 maintenance                                                                                                            | Nest 12 feature                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Version / channel        | `0.4.0` / `nest11`                                                                                                             | `0.5.0` / `next`                                                                                                               |
| Source                   | `49cfb7208ff555402dd39dd339accb5178371b53`                                                                                     | `6204bab6f0c8614477da12ca16ea4c7ba202536b`                                                                                     |
| Preparation              | [43841859158](https://github.com/anarchitects/anarchitecture-community/actions/runs/43841859158)                               | [43863975934](https://github.com/anarchitects/anarchitecture-community/actions/runs/43863975934)                               |
| Release                  | [43846910405](https://github.com/anarchitects/anarchitecture-community/actions/runs/43846910405), succeeded                    | [43865196610](https://github.com/anarchitects/anarchitecture-community/actions/runs/43865196610), succeeded                    |
| Publisher                | [43847457373](https://github.com/anarchitects/anarchitecture-community/actions/runs/43847457373), failed after accepted upload | [43865542045](https://github.com/anarchitects/anarchitecture-community/actions/runs/43865542045), failed after accepted upload |
| Final-byte certification | 48 checks; three zero-finding runtime audits                                                                                   | 21 checks; two zero-finding runtime audits                                                                                     |
| Archive SHA-256          | `d044f4052003b6be08fb89980d40ce7d5adc3941bdce49380091fd936354fbbb`                                                             | `0d65ccb9e9b9395c1dbad3a70d49af409bd0543f890fbbf507074722954608f1`                                                             |

For 0.5.0, retained artifact `14224489120` has release-record SHA-256
`22a951e8e783ca872554a25be667be672ac4943fdf6bd08d668d2a19c88ced74`.
The annotated tag resolves exactly to the approved source; GitHub reports the tag
unsigned, distinct from signed-commit protection. Nx-generated notes match the
integrated request verbatim, including the disclosed historical #756 body defect;
the package README has current migration guidance.

npm accepted 0.5.0 at 12:20:49 UTC and reported processing. The controller checked
availability immediately and failed at 12:20:50. At 12:26:53, independent registry
download verified all 32,949 bytes against the approved SHA-256, SHA-512 integrity
and SHA-1. Channels were `next=0.5.0`, `nest11=0.4.0`, `latest=0.3.2`.
Registry npm/SLSA statement subjects, workflow, source and run bindings match;
independent cryptographic Sigstore-chain verification was not performed.

The successful release receipt and original publisher receipt (`complete:false`)
are preserved, together with separate registry reconciliation. Neither failed run
was rerun or relabelled successful, and no upload was repeated. Publisher Node
24.22.2/npm 11.19.1 met the ordinary OIDC publication floor. npm dist-tag promotion
remains unavailable until its separate permission/toolchain gates and owner
authorization are satisfied. SSR runtime certification used Node 24.22.3.

## Acceptance boundary and ongoing maintenance

The settings blocker is resolved. Owner acceptance of this final record completes
#722; it does not imply that every package has a publisher, that PyPI was exercised,
or that all release automation defects are fixed. Local rejection tests and live
settings remain distinct from destructive denial probes, which were not performed.

Keep these follow-through items with [#742](https://github.com/anarchitects/anarchitecture-community/issues/742)
and release-operation work:

- Tolerate bounded npm validation delay in post-upload verification without
  repeating uploads; retain original partial receipts and reconciliation.
- Johan copies each release's exact archives, records and receipts to encrypted
  USB **Anarchitects** and **Asustor Lockerstor AS6604T**, verifying hashes before
  GitHub expiry. Local bundles are not proof of either durable copy or restoration.
- Hand published version/support evidence to the existing consumer issues;
  application owners retain adoption and deployment acceptance. `next` publication
  does not silently authorize `latest` promotion or declare general availability.

Controls were restored to `paused` at **12:21:16 UTC**. Future activation requires
the relevant owner's release intent and current record/settings review; both
environment approvals remain mandatory. Recheck affected evidence after changes
to owners, App installations/keys, secrets, workflows, rules/checks, registry
trust/tokens, toolchains, retention or custody. Do not restore broad credentials
or main bypass as recovery. No new hosted run is authorized by this document.

This documentation applies the existing accepted release, owner-authority,
immutable-history and evidence-custody decisions. It changes no runtime code,
dependency, release policy or supported adapter/version contract.
