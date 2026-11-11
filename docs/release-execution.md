# Owner-authorized release execution

This is the staged implementation of [#721](https://github.com/anarchitects/anarchitecture-community/issues/721)
and the [accepted control design](release-controls.md). **It is not an activated
release route.** #722 must verify settings, close legacy access and obtain owner
acceptance before activation. No release, hosted run or CI monitoring is authorized
by this document. Johan (`vrxj81`, GitHub ID `5003361`) remains the confirmed owner
for all 21 projects in [OWNERSHIP](../OWNERSHIP.md).

## Preparation and review

1. Start from a clean, fully fetched checkout. Resolve publication discrepancies
   before preparing a version: the [history/version guard](release-version-policy.md)
   still blocks the Governance discrepancies in the #719 inventory. Use a
   read-only GitHub credential for history access, with no registry token,
   publication OIDC or release App credential in the preparation environment.
2. Prepare a compatibility JSON file **outside the checkout**, keyed by exact Nx
   project name. Include `minimumBump` (`none`, `patch`, `minor`, `major`) and an
   `evidence` reference to the reviewed public-contract impact. Cover every
   dependent that Nx proposes changing, not just the initial selection. For example:

   ```json
   {
     "editorjs-html": {
       "minimumBump": "patch",
       "evidence": "Owner-reviewed issue/PR and compatibility checks for this candidate"
     }
   }
   ```

3. Run the uncached local preparation target, substituting the real selection and
   evidence path. `NX_NO_CLOUD=true` is mandatory; this does not start hosted work:

   ```sh
   NX_NO_CLOUD=true NX_DAEMON=false yarn nx run @anarchitecture-community/source:prepare-release-version --projects=editorjs-html --compatibility=/absolute/path/compatibility.json
   ```

   Nx calculates independent versions from Conventional Commits, expands version
   effects, updates manifests/locks and writes project changelogs. The command
   writes `.release/request.json`, but does not stage, commit, tag, push, create a
   GitHub Release or publish. Existing build/version actions execute without
   publication credentials. Review the resulting diff, including the Python
   runtime manifest hook and dependent version changes; sign and submit it through
   normal main protection. Use all affected project scopes in its Conventional
   Commit title. Obtain any required permission for the PR's normal CI run.

   Use `--first-release` only for a selection with no distribution history; Nx is
   explicitly given `0.0.1`. Ordinary releases retain the accepted **0.x** behavior.
   An explicit move to `1.0.0` uses `--stabilize` for one already-released 0.x
   project and requires `stableTransition: { "version": "1.0.0", "evidence":
"reference to the owner's explicit stable-release decision" }` in its
   compatibility entry. This is not an arbitrary version override. Dependent
   effects still need review. Later releases on a stable line use normal Nx rules.

4. After integration, obtain green required `main` CI for the **exact versioned
   commit**. With separately authorized hosted preparation, dispatch the following
   workflow from main, substituting that successful CI run ID:

   ```sh
   gh workflow run release-prepare.yml --repo anarchitects/anarchitecture-community --ref main -f ci_run=123456789
   ```

   Preparation checks current main, the integrated request and fresh Nx/history
   results, and validates actual commits added since the request's source baseline.
   Earlier intent is represented by Nx's Conventional Commit calculation and the
   owner's compatibility evidence. It runs package checks and applicable existing
   Nest, Governance and Better Auth gates. The exact main CI contract continues to
   supply Editor.js compatibility/security/packed coverage, including its reviewed
   affected selection; a prior pre-version run does not qualify.

   Final builds precede archive retention. Archives are inspected for identity,
   dependency protocols, exports, declarations/styles, README/LICENSE, runtime pin
   and safe inventories. npm archives are installed in isolated consumers with
   scripts disabled, and installed files are compared to the retained inventories.
   Consumer locks, tool versions, SHA-256 inventories, dependency publication
   closure, compatibility, CI identity and the renderer G07 exception are recorded.
   Python keeps exactly one wheel and one sdist; dbt records its Git subdirectory
   and tree. No candidate code runs in the credentialed execution jobs.

5. Preserve the preparation summary's **artifact ID** and **SHA-256 of
   `release-record.json`**. The latter is not the upload action's ZIP digest.
   Download and review the immutable `community-release-record` artifact, including
   every expanded package, channel, archive, dependency and evidence entry. The
   controller verifies it came from a successful first attempt of this repository's
   main preparation workflow, not an arbitrary PR or artifact with the same name.

## Authorized mutations after #722 activation

Dispatch tags/releases using the record identity; leave legacy version inputs empty:

```sh
gh workflow run release.yml --repo anarchitects/anarchitecture-community --ref main -f record_artifact_id=123456 -f record_digest=REPLACE_WITH_64_HEX_RECORD_SHA256
```

The review job verifies the record and displays the current remaining operations.
Johan reviews the candidate/evidence and approves the run's `community-release`
environment. The execution job reads the native approval history and checks the
numeric owner identity, main controller, run and first attempt. It repeats all
preflight reads before creating any tag. An App token restricted to contents write
creates only the exact approved tags and GitHub Releases; no new version commit
or build is made. Tag conflicts or unexpected history stop execution. A new tag
requires the candidate still to be current main; retries of existing tags verify
their original commit.

Each `release.published` event only forwards the record/tag to a main dispatch of
`publish-controller.yml`. The forwarder has actions-write for dispatch, no checkout,
OIDC or App key. Each resulting publishing run needs a **separate** owner review of
`community-publish`. Event delivery does not carry release approval. For a manual
publish or recovery, use the same controller directly:

```sh
gh workflow run publish-controller.yml --repo anarchitects/anarchitecture-community --ref main -f tag=editorjs-html@0.0.5 -f record_artifact_id=123456 -f record_digest=REPLACE_WITH_64_HEX_RECORD_SHA256 -f operation=publish
```

These example IDs/versions are placeholders, not a release proposal. The manual
`publish.yml` entry point forwards the same fields and follows the same checks.
An owner-created capability tag must point to the recorded commit and still uses
this publishing approval. Old tag workflows must not be used for recovery.

The execution job publishes the retained npm `.tgz` with scripts disabled and
provenance, or only missing approved Python wheel/sdist files using mandatory OIDC.
It never runs Nx publication dependencies under a publishing credential. It instead
verifies every required dependency's published archive bytes, including the Python
host's dbt runtime. Publish prerequisites first. A dependent request that arrives
too early fails before upload and needs a new dispatch after its prerequisite;
GitHub event ordering is not assumed. dbt distribution is its verified Git tag and
subdirectory, not an uploaded release asset.

Tags/releases and publishing share `community-publication` with
`cancel-in-progress: false` and `queue: max`. This serializes mutation across
workflows and retains up to 100 pending runs; excess work needs a new dispatch.
See [GitHub's queue announcement](https://github.blog/changelog/2026-05-07-github-actions-concurrency-groups-now-allow-larger-queues/).

## Verification, interruption and recovery

- **Retry with a fresh dispatch, never GitHub “Re-run jobs”.** Attempts greater than
  one are rejected so a retry cannot inherit an earlier environment approval. Use
  the original immutable record and obtain fresh owner review. The summary lists
  remaining mutations; execution rereads live state after approval.
- Already published npm/Python files are downloaded and SHA-256 compared before
  skipping them. Partial wheel/sdist publication uploads only the missing file.
  Existing GitHub Releases must link to the same record. Errors reading history
  are failures, not proof that a version is absent. Never move a conflicting tag,
  overwrite a version or silently advance beyond an undistributed baseline.
- If bytes match but an npm channel differs, ordinary publication stops. A separate
  `operation=channel` dispatch can move only the channel already recorded for that
  version, with new owner review. A different desired channel needs a new reviewed
  record. The CLI guards require reviewed npm 11: at least 11.5.1 for publication,
  and 11.21.0 for channel operations. #722 must verify the installed CLI and the
  publisher's opt-in **Allow npm dist-tag** permission before channel use. See
  [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
- Receipts retain request/digest, approval identity, workflow revision/run/attempt,
  completed operations and observed tag object/peeled commit, release and registry
  identities. A partial receipt is not success. npm integrity and available
  attestation metadata are retained; this does not assert that an older manually
  uploaded version has provenance. Resolve missing or unacceptable provenance with
  the owner before accepting such a recovery.
- Preparation artifacts and receipts request 90-day retention, subject to effective
  repository limits. Preserve them and their hashes in the owner's durable release
  evidence store **before expiry**, through publication and recovery. #722 must
  agree and verify that storage/retention arrangement. The controller rejects
  expired or missing GitHub artifacts; an external backup does not silently become
  an authorized input. Renewed evidence requires a new trusted record and review.
- Candidate, scope, controller, version, channel or archive changes invalidate the
  old handoff. Controller identity includes release tooling/workflows, root config,
  lockfile, ownership and the accepted design. Prepare/revalidate a new record.
  If a public version already exists, preserve its bytes/history; use separately
  authorized manual recovery when a new candidate cannot represent those bytes.
- npm first publication may require owner-authenticated bootstrap; PyPI may use a
  verified pending trusted publisher. Manual bootstrap uses these same reviewed
  archives, readiness and explicit authorization, followed by byte reconciliation.
  No placeholder package or fallback long-lived token is introduced.

Publication is not consumer adoption. The owner separately accepts the verified
result and decides the disposition of failures, corrections or deprecations.

## #722 activation handoff

At merge, an **unset** `COMMUNITY_RELEASE_CONTROLS` variable retains the transitional
legacy jobs, subject to existing explicit owner authorization. `active` selects the
new route; other nonempty values disable mutation jobs. Do not set `active` merely
to try the implementation. This variable is not a substitute for access controls.

During the owner-agreed maintenance window, #722 must:

1. Quiesce pending/in-progress legacy runs and approvals, preserve partial evidence,
   and confirm an owner-operated manual route. Use a nonempty pause value during
   cutover; keep the current route available until that agreed window.
2. Configure both environments: only `vrxj81`/`5003361` as reviewer, self-review
   permitted, admin approval bypass disabled, only protected main allowed. Verify
   approval-history access with the controller's actions-read token.
3. Move the App private key/client ID behind `community-release`; scope the
   installation and remove equivalent unguarded repository/organization credentials.
   Verify capability tag creation and separate update/deletion protections and main
   branch rules. The new preparation PR route does not need bot main bypass.
4. Bind every npm/PyPI publisher to this repository, **publish-controller.yml** and
   **community-publish**. Remove old `publish.yml`/environment-free trust and token
   routes. Verify bootstrap access, npm CLI/provenance, uv OIDC and channel permission
   without publishing test packages. Old tags retain old workflow files; removing
   the current legacy job alone cannot revoke their credentials or registry trust.
5. Remove the transitional `release` job in `release.yml` and `publish` job in
   `publish.yml` through reviewed code, including their unused inputs/credentials.
   Verify remaining entry points, forwarding, run/ref rejection, queue behavior,
   artifact/receipt retention and the protected environment settings. Any hosted
   evidence needs its own explicit credit authorization.
6. Read back the effective settings, record owner acceptance and then enable
   `COMMUNITY_RELEASE_CONTROLS=active`. If enforcement is unavailable, keep releases
   paused or use the accepted manual route; do not restore broad authority.

## Local evidence and boundaries

`test-release-policy` runs offline regression tests through Nx. Disposable Git
repositories exercise the installed Nx's initial/0.x/stable calculations and local
version/changelog preparation without staging, commits or tags. Fake GitHub/registry
responses exercise invalid ownership, foreign/expired artifacts, controller drift,
failed exact-candidate CI, stale history, conflicting tags/archives, channel intent
and interrupted publication. An actual isolated npm install verifies retained bytes
and disabled lifecycle hooks. These tests perform no public mutations.

Configuration, history, candidate preparation and mutation remain uncached and
undistributed. Deterministic tests may cache; their workflow/tool/runtime inputs are
declared. The required `main` CI aggregate, #712 selection scope, #667 packed redesign
and renderer G07 exception remain unchanged. Hosted enforcement, registry trust and
production publication have **not** been demonstrated by these local tests.

Architecture preflight on 11 November 2026 enumerated/read all 24 Meta ADRs and all
nine Community ADRs, every status. Meta ADR content at `ec77aa8` is unchanged through
`b2cc857bef3ecc4180ca8180db015ba5537bc497`; the Community base is `68ea203`.
CONTRIBUTING, OWNERSHIP, SDLC, release/compatibility and CI/protection guides were
reviewed. Meta0013/Community0007 govern independent versions and explicit stable
transition; Meta0015 keeps mutable authorization/state outside cache/DTE;
Meta0016/0017/0019 separate ownership, approval and delivery; Community0004 governs
final package documentation. Proposals do not override accepted decisions. No
accepted conflict or new policy exemption was identified.
