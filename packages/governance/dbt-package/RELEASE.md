# governance-dbt-package Release Guide

## Release Model

`governance-dbt-package` is a dbt package release.

- It is not an npm package release.
- It is not a PyPI release.
- It does not compile application code.
- The `pack` target assembles a distributable dbt package directory under [dist](./dist).
- Git tags and GitHub releases are the first public distribution mechanism.
- dbt Hub publication is explicitly out of scope here and tracked by [#462](https://github.com/anarchitects/anarchitecture-community/issues/462).

This repo already uses Nx Release with independent project versioning and project-scoped tags. The companion dbt package follows that existing repo convention instead of introducing a second tag format.

## Versioning

The package version lives in [dbt_project.yml](./dbt_project.yml).

- Update the dbt package version before release.
- The Git tag must use the same version suffix.
- Nx Release reads and updates `dbt_project.yml` directly for this project.

Example:

- `dbt_project.yml` version: `0.1.0`
- Git tag: `governance-dbt-package@0.1.0`

## Installation Revision

Released consumers should install by Git URL, released tag, and subdirectory:

```yaml
packages:
  - git: 'https://github.com/anarchitects/anarchitecture-community.git'
    revision: 'governance-dbt-package@0.1.0'
    subdirectory: 'packages/governance/dbt-package'
```

Use released tags for stable consumption. Local path installs remain the preferred development workflow.

## Preferred Release Path

Use the existing manual Nx release workflow for this repository:

- GitHub Actions workflow: `.github/workflows/release.yml`
- Trigger: `workflow_dispatch`
- Project input: `governance-dbt-package`

That workflow:

- runs `nx release --skip-publish`
- updates the project version using the dbt package version actions
- creates the project-scoped Git tag
- creates the GitHub release

After the GitHub release is published, `.github/workflows/publish.yml` performs package-scoped validation and runs the `nx-release-publish` target. For this dbt package, that publish target verifies the packed artifact and exits without publishing to an external registry.

## Release Checklist

- Confirm [dbt_project.yml](./dbt_project.yml) version.
- Run `yarn nx run governance-dbt-package:validate`.
- Run `yarn nx run governance-dbt-package:pack`.
- Inspect [dist](./dist).
- Confirm README install examples.
- Confirm Git install examples use the correct release tag.
- Confirm compatibility notes with `anarchitecture-dbt-governance`.
- Create the package-scoped Git tag.
- Create the GitHub release.
- Keep release notes explicit that this is the dbt companion package, not the Python CLI or npm runtime.
- Do not update dbt Hub docs until [#462](https://github.com/anarchitects/anarchitecture-community/issues/462) is complete.

## Manual Commands

Validate and pack locally:

```bash
yarn nx run governance-dbt-package:validate
yarn nx run governance-dbt-package:pack
ls -la packages/governance/dbt-package/dist
```

Local Nx Release invocation:

```bash
yarn nx release --projects=governance-dbt-package 0.1.0 --skip-publish
```

Fallback manual tag commands if you are not using `nx release` to create the tag:

```bash
git tag governance-dbt-package@0.1.0
git push origin governance-dbt-package@0.1.0
```

Optional GitHub CLI release creation:

```bash
gh release create governance-dbt-package@0.1.0 \
  --title "governance-dbt-package 0.1.0" \
  --generate-notes
```

## Notes For Release Authors

- The repo-wide Nx tag convention is `<project>@<version>`.
- The companion package version is independent from the Python CLI package version.
- The publish step for this project is intentionally registry-free.
- dbt Hub publication remains future work under [#462](https://github.com/anarchitects/anarchitecture-community/issues/462).
