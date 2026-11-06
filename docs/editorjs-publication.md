# Editor.js publication and renderer recovery

The Editor.js packages use independent Nx releases. Follow Community ADR 0007
and Meta ADR 0013: published versions and tags are immutable history, and normal
Conventional Commits determine subsequent versions.

## Renderer 0.0.1 installation failure

The public `@anarchitects/editorjs-html@0.0.1` archive contains a runtime dependency
on `@anarchitects/editorjs-core` with range `workspace:^`. npm consumers reject
that range with `EUNSUPPORTEDPROTOCOL`. The Angular renderer also fails to install
because it depends on the headless renderer. See [#76](https://github.com/anarchitects/anarchitecture-community/issues/76)
for registry checks, archive identities and clean-install reproductions.

The correction uses a registry-compatible core range. Yarn still resolves that
range to the matching workspace during development. Package regression tests and
all renderer/authoring packed consumers now use `npm pack --ignore-scripts`, so
Yarn's manifest rewriting cannot conceal a defect in the npm publication path.
The ordinary headless `test` target includes the npm-archive regression, and the
Publish workflow runs it before publishing. Its inferred CI atom depends on build.

The Angular renderer versions both its source and generated APF manifests.
Otherwise a later build in the Publish workflow could recreate an old version
and dependency range from unchanged source metadata. Package checks compare
version/dependency metadata to the current source rather than requiring 0.0.1.

## Renderer 0.0.2 publication failure

Both 0.0.2 GitHub release tags exist, but the headless Publish workflow failed
before invoking npm: Nx Release also rejects local protocols in development
dependencies when publishing from a Yarn workspace. The five tool development
dependencies still used `workspace:^`. Angular renderer 0.0.2 reached npm, but
its `^0.0.2` headless dependency could not be installed while that version was
absent. The original npm-pack regression missed this Nx-specific preflight.

The follow-up uses ordinary semver ranges for all five development dependencies;
Yarn continues to resolve the matching local workspaces. The archive regression
now checks development dependencies as well. A second regression runs the actual
`yarn nx release publish --projects=editorjs-html --dry-run --yes --skipSync`
command and requires successful dry-run publication output. Both checks failed
on the 0.0.2 manifest and pass with the correction. The publish regression sets
`NX_DRY_RUN=true` in addition to the CLI flag and disables Nx Cloud. It tests the
local publication path, not npm authentication, provenance or public availability.

## Corrective release

After the fix is merged and its required CI passes, select both
`editorjs-html,editorjs-html-angular` in the existing Release (Manual) workflow,
with specifier `patch` and `first_release` false. Starting from the verified
0.0.2 tag history, the next patch versions are:

| Package                               | New version | Internal runtime dependency |
| ------------------------------------- | ----------- | --------------------------- |
| `@anarchitects/editorjs-html`         | 0.0.3       | core `^0.0.1`               |
| `@anarchitects/editorjs-html-angular` | 0.0.3       | headless `^0.0.3`           |

Both releases are necessary: Angular renderer 0.0.2's `^0.0.2` dependency
excludes headless 0.0.3. Do not overwrite the old release or manually edit versions
in a development fix. Nx owns source/dist versions and dependency updates.

The release workflow creates tags and GitHub releases; their Publish workflows
publish the packages. If manual publishing is needed, check out the exact new
release tag, install dependencies and run its Nx build, typecheck and test gates.
Pack headless from `packages/editorjs/html` and the Angular renderer from
`packages/editorjs/html-angular/dist`. Inspect those npm archives before
publishing; make the corrected headless version available before the Angular
renderer. Registry authentication/trusted-publisher setup remains a maintainer
operation.

## Verification before closing #76

Verify actual public metadata and tarballs for the new versions, including
ordinary semver runtime dependencies, versions, README/LICENSE and public
exports/declarations. In separate clean directories outside this workspace,
install the exact public headless and Angular versions from npm and run their
documented examples. The neutral consumer must not acquire Angular, Forms, Nest,
Nx or Editor.js authoring dependencies. Reconcile fresh packed-consumer evidence
with the final published bytes and the exact release commit's CI.

Keep #76 and #651's outreach gate open until those public checks pass. Local
archives, release dry runs and a successful GitHub release do not prove public
npm installability. The existing renderer remote-cache/DTE exception is separate
from publication and does not authorize hosted monitoring or reruns.
