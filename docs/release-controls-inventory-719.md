# Release-control inventory for #719

Read-only snapshot: **9 November 2026**, Community main
`ce588355789464be1b4ed75e9afcb9a5d156608c`, installed Nx **23.2.1**.
This is evidence for the [accepted release-control design](release-controls.md),
not a release-readiness certificate or live permission change.

## Execution paths observed in the repository

| Route                                                                        | Actual behavior                                                                                                                                                                                                                                                                 | Authorization / recovery gap                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Release (Manual)](../.github/workflows/release.yml)                         | Dispatch on `main`; optional projects/specifier/first-release inputs; App-token checkout and `nx release --skip-publish`; serial release concurrency. Nx builds, versions, commits/tags and creates configured GitHub Releases.                                                 | No separate owner approval or frozen final-candidate record. App credential is available before dependency installation/build/release. Raw workflow inputs are interpolated into shell commands.                                                |
| [Publish](../.github/workflows/publish.yml)                                  | `release.published` or manual dispatch with a tag. Splits `<project>@<version>`, checks project existence, checks out tag, validates/builds and runs `nx release publish --projects … --yes`. Per-tag concurrency; `contents: read`, `id-token: write`, npm provenance enabled. | A tag push alone does not trigger it. Project existence is weaker than a release allowlist. No owner/environment gate, full immutable evidence binding or explicit dependency-publication approval. An old tag can carry old workflow behavior. |
| npm publish targets                                                          | All 19 resolve to `@nx/js:release-publish` with `dependsOn: ["^nx-release-publish"]`. Most publish from the project root; Angular packages explicitly select package-local `dist`.                                                                                              | A selected project can trigger other publish targets. Installed Nx publishes directories, permits lifecycle execution and can skip an existing version or move its dist-tag without comparing the approved archive's integrity.                 |
| [Python host publisher](../tools/release/publish-governance-host-dbt.cjs)    | Nx build dependency; wrapper runs `uv publish dist/*` in the host directory, forwards applicable arguments/environment and translates dry-run options.                                                                                                                          | No owner gate in the wrapper, no exact file allowlist; effective PyPI trust/credentials not verified. npm-only flags are ignored, not proof of matching registry behavior.                                                                      |
| [dbt package publisher](../tools/release/publish-governance-dbt-package.cjs) | Nx pack dependency; checks output directory and reports Git tag/GitHub Release distribution.                                                                                                                                                                                    | No release-asset upload. A successful local target does not prove the expected remote tag/release/subdirectory exists.                                                                                                                          |
| Manual/bootstrap/retry/recovery                                              | Existing tag dispatch, workflow rerun, local npm publication and custom publisher invocation can reach distribution paths. Latest registry metadata includes both human and GitHub Actions publication.                                                                         | No unified authorization record, retry integrity comparison or documented enforced cutover. Human authentication, workflow access and bot credentials are execution capabilities, not owner approval.                                           |

[nx.json](../nx.json) declares 21 independently versioned release projects,
Conventional Commits, automatic dependent updates, and `{projectName}@{version}`
tags. The pre-version command builds the workspace without a project filter.
The explicit type map omits `perf`, `revert` and `build` from Meta0013's baseline;
#720 owns the complete allowed-type review, not a guessed bump change here.

The [Python version hook](../tools/release/governance-host-dbt-version-actions.cjs)
also models `governance-runtime-dbt` from the runtime manifest and updates the pin.
The [dbt version hook](../tools/release/governance-dbt-package-version-actions.cjs)
updates `dbt_project.yml` and resolves from Git tags with a disk fallback. Its null
registry result does not mean the package has never been distributed.

Resolved target inspection used a local Nx graph with Cloud and the daemon off.
Installed publisher behavior was read in
`node_modules/@nx/js/dist/src/executors/release-publish/release-publish.impl.js`.
No release dry run, build, tag, publication or hosted CI inspection was performed
for this inventory. The existing publisher's checks are described in the workflow;
the design retains the broader applicable release gates as well.

## Distribution history

All **21** release projects already have distribution history. npm names are
`@anarchitects/<Nx project>` for the 19 npm rows below. Source versions are from
the reviewed commit, not inferred from registry `latest`. Ownership follows
[OWNERSHIP.md](../OWNERSHIP.md); the private fixture apps are excluded.

| Nx project                      | Owner scope        | Channel                               | Source version | Latest public version |
| ------------------------------- | ------------------ | ------------------------------------- | -------------- | --------------------- |
| better-auth-typeorm-adapter     | Auth               | npm                                   | 0.2.0          | 0.2.0                 |
| nest-angular-ssr                | SSR                | npm                                   | 0.3.2          | 0.3.2                 |
| governance-core                 | Governance         | npm                                   | 0.4.4          | 0.4.4                 |
| governance-adapter-dbt          | Governance         | npm                                   | 0.1.10         | 0.1.10                |
| governance-adapter-typescript   | Governance         | npm                                   | 0.4.4          | **0.4.2**             |
| governance-extension-dbt        | Governance         | npm                                   | 0.1.11         | 0.1.11                |
| governance-extension-typescript | Governance         | npm                                   | 0.2.4          | **0.2.2**             |
| governance-runtime-dbt          | Governance         | npm                                   | 0.1.8          | 0.1.8                 |
| governance-cli                  | Governance         | npm                                   | 0.6.3          | **0.6.1**             |
| governance-host-dbt             | Governance         | PyPI: `anarchitecture-dbt-governance` | 0.0.10         | 0.0.10                |
| governance-dbt-package          | Governance         | Git tag / GitHub Release              | 0.0.3          | 0.0.3                 |
| editorjs-core                   | Visual Composition | npm                                   | 0.0.1          | 0.0.1                 |
| editorjs-angular                | Visual Composition | npm                                   | 0.0.1          | 0.0.1                 |
| editorjs-tool-paragraph         | Visual Composition | npm                                   | 0.0.1          | 0.0.1                 |
| editorjs-tool-header            | Visual Composition | npm                                   | 0.0.1          | 0.0.1                 |
| editorjs-tool-list              | Visual Composition | npm                                   | 0.0.1          | 0.0.1                 |
| editorjs-tool-quote             | Visual Composition | npm                                   | 0.0.1          | 0.0.1                 |
| editorjs-tool-image             | Visual Composition | npm                                   | 0.0.1          | 0.0.1                 |
| editorjs-upload-fetch           | Visual Composition | npm                                   | 0.0.1          | 0.0.1                 |
| editorjs-html                   | Visual Composition | npm                                   | 0.0.3          | 0.0.3                 |
| editorjs-html-angular           | Visual Composition | npm                                   | 0.0.4          | 0.0.4                 |

Important history observations:

- `governance-adapter-typescript` has Git tags `0.4.3`/`0.4.4` beyond npm/GitHub
  Release `0.4.2`; `governance-extension-typescript` has `0.2.3`/`0.2.4` beyond
  `0.2.2`; `governance-cli` has `0.6.2`/`0.6.3` beyond `0.6.1`. These are observed
  channel discrepancies, not proof of their cause or permission to republish.
- Better Auth and Nest have historical first npm `0.1.0`; preserve grandfathered
  history rather than renumbering to `0.0.1`. Governance npm/Python histories
  include `0.0.1`; dbt tags/releases include `0.0.1` through `0.0.3`.
- Editor.js metadata also includes `0.0.0-stage`. Record existing history without
  adopting it as an allowed bootstrap pattern. All ten have stable publication.
  `editorjs-html@0.0.2` has a tag/GitHub Release but no npm version.
- npm still marks `editorjs-html@0.0.1` and `editorjs-html-angular@0.0.1`/`0.0.2`
  deprecated, directing consumers to corrected `0.0.3` or later. No version was
  deprecated, unpublished, republished or moved during this review.
- Latest npm metadata attributes Better Auth, seven Governance npm packages and
  the two HTML renderers to GitHub Actions, with trusted-publisher/provenance
  metadata. Nest and eight Editor.js authoring packages name `vrxj81` without that
  metadata. Neither group proves its **current** administrative trust settings.
- Observed GitHub Releases are bot-authored, report `immutable: false`, and have
  no attached assets. The release catalog alone is not a complete tag or registry
  history. Python's latest wheel/sdist are public and were uploaded 27 June 2026.

Sources: complete public npm metadata for each named package at
`https://registry.npmjs.org/@anarchitects%2F<project>`, the
[PyPI JSON record](https://pypi.org/pypi/anarchitecture-dbt-governance/json),
the paginated [GitHub Releases API](https://api.github.com/repos/anarchitects/anarchitecture-community/releases),
and remote Git refs from `git ls-remote --tags origin`. Registry metadata was
read for all 19 npm projects; no dependency installs or archive execution were
needed. These are dated observations; publication must query history again.

## Effective settings observed and access limits

GitHub API reads covered repository environments, effective repository/parent
rulesets and rule details, default workflow permissions, relevant secret **names**,
the public release App definition and authenticated public user profile.
Secret values and tokens were never inspected or recorded.

| Surface                | Observed 9 November                                                                                                                                                       | What remains unverified                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub environments    | Repository API returns zero environments. Release/Publish YAML names none.                                                                                                | Proposed required-reviewer controls and any plan-specific limitations must be checked before activation.                                                                  |
| Effective rulesets     | One active branch ruleset, `main` / ID `14374927`; no tag ruleset returned, including parent rules.                                                                       | Future owner-team/tag patterns, allowed/rejected effective actors and any classic protection interactions at cutover.                                                     |
| `main` controls        | Default branch; deletion/non-fast-forward restrictions, signed commits, squash-only PRs, strict `main` check from GitHub Actions App `15368`; zero required PR approvals. | Re-read against the final workflow/check contract; this snapshot is not permission to weaken any safeguard.                                                               |
| Bot bypass             | Integration `3090882` has an always bypass on the main ruleset; current user cannot bypass it.                                                                            | Whether the final design still needs this bypass; do not remove it before verifying a usable route.                                                                       |
| Release App            | Public `anarchitects-bot` ID `3090882`, owned by `anarchitects`, requests `contents: write` and `metadata: read`.                                                         | Installed repository selection, effective grants and credential custody/rotation. Public App permissions are not an installation audit.                                   |
| Workflow token default | Repository default is `write`, PR-review approval disabled. Release/Publish override contents to read; Publish grants OIDC write.                                         | Other effective credential paths and minimum rights after the controller split.                                                                                           |
| Bot secret references  | Workflow references `ANARCHITECTS_BOT_CLIENT_ID` / `ANARCHITECTS_BOT_PRIVATE_KEY`; filtered repository secret-name query returns neither.                                 | Organization secret inventory returned HTTP 403 requiring `admin:org`. Inheritance/allocation is unknown; absence at repository scope does not prove missing credentials. |
| npm                    | Public publisher/provenance history as above; public maintainer metadata names `vrxj81`.                                                                                  | Current trusted-publisher tuples/allowed actions, environments, collaborator rights, 2FA/token policy and alternate credentials for all packages.                         |
| PyPI                   | Public host versions and file metadata verified.                                                                                                                          | Current publisher tuple/environment, project roles, recovery credentials and effective uv authentication.                                                                 |
| Owner identity         | Authenticated GitHub public profile: Johan Vrolix, login `vrxj81`, ID `5003361`.                                                                                          | Explicit owner confirmation before binding authorization to this account.                                                                                                 |

An attempted read-only npm settings inspection did not reach the package settings:
the shared Safari window changed during navigation, so inspection stopped without
changing settings. No access expansion was requested to overcome the organization
API restriction. #722 must obtain authorized administrative read-back; these
unknowns are activation blockers, not claims that a particular control is absent.

## Evidence boundaries and maintenance

After this inspection, Johan accepted the design and explicitly confirmed the
owner identity on 9 November 2026, as recorded in the [acceptance record](release-controls.md#implementation-handoff-and-acceptance).
That resolves the identity-confirmation gap above; the administrative settings
and trust verification gaps remain activation blockers for #722.

This inventory does not establish green CI for a release candidate, prove the
integrity of every historical package, or certify present registry permissions.
No CI monitoring, reruns, hosted experiments, extra workers, workflow dispatches,
settings mutations or distribution mutations occurred.

Refresh the applicable evidence when release tooling, Nx/publisher versions,
owners, project/dependency mappings, distribution channels, workflow refs,
environment/trust settings, rulesets or required checks change. #720–#722 must
replace the relevant unknowns with read-back and tests before claiming enforcement.
Keep original historical observations dated rather than silently rewriting them.
