# ADR: Initial package releases and Nx-compatible versioning

- **Status:** Proposed
- **Date:** 2026-10-14
- **Scope:** All Anarchitects versioned/distributed packages
- **Canonical owner:** anarchitecture-meta

## Context

Packages in Nx monorepositories have independent release lifecycles. Initial implementation should not produce automatic version increments. Some workspaces already infer releases from Conventional Commits; anarchitecture-contracts was migrated to Nx version plans to preserve Changesets intentions, without an explicit architectural decision to retain plans permanently. The organization chooses one consistent versioning authority: Conventional Commits, with package-specific quality and compatibility gates.

## Decision

1. **First official distribution release MUST be exactly `0.0.1` per package**, whether published through npm, GitHub Releases or another distribution channel. The package manifest, release tag and artifact metadata must agree. An additional channel carrying the same already-released version is not a second initial release. Existing published history and tags are not rewritten.
2. **Before its first release, package-specific development MUST use `init(<nx-project-name>): ...`**. The `init` Conventional Commit type MUST be explicitly configured with `semverBump: "none"` in `nx.json`. An `init` commit does not imply or authorize publishing; an explicit release operation must select and verify `0.0.1`.
3. **After first release, use normal Conventional Commits for SemVer** (`feat`, `fix`, breaking-change syntax and configured non-bumping types). Published `0.0.x` packages are already released and cannot use `init` for ordinary changes. A mixed commit touching unreleased and released packages must be split or otherwise produce reviewable, correct per-project release intent.
4. **All scoped Conventional Commits MUST use an actual, exact Nx project name** from the active project graph, not an arbitrary directory, npm scope or release group. For purely repository-wide changes, unscoped commits are allowed. Validate scopes in CI and agent instructions. Nx release-group names are not substitutes for Nx project names.
5. **Independent packages should use independent Nx release relationships**, preserving project-specific tags and independently tracked release state. Do not apply one repository-wide initial state to every package.
6. **Nx Conventional Commits are the version-bump authority throughout Anarchitects. Nx version plans are NOT the ongoing workflow.** In particular, **anarchitecture-contracts MUST remove `release.versionPlans`, `version.specifierSource: "version-plans"`, and version-plan creation/consumption requirements**, and enable `release.version.conventionalCommits: true`. Retain its independent projects, package identity and release-tag patterns.
7. **Keep contract-specific compatibility gates.** OpenAPI/contract compatibility, baseline comparisons, and migration-impact review remain required. Gates must assess the actual conventional-commit-derived proposed release version against detected compatibility impact, and reject insufficient bumps. A `fix` that breaks a public HTTP contract cannot silently pass as a patch. Existing pending Changesets/version plans must be assessed and migrated deliberately to preserve meaningful release intent; do not discard pending changes or rewrite published history.
8. **No unapproved first-version exception.** New packages do not start at `0.1.0` or `1.0.0`; official prerelease distribution before initial `0.0.1` is not permitted. Internal non-distributed builds do not count as releases. Existing published prerelease/version histories are grandfathered.
9. **Automated enforcement required.** Commitlint or equivalent must use Nx project graph for scope validation, Nx Release must configure non-bumping `init`, and publication CI must assert correct `0.0.1` first releases against tags and appropriate registries. Tests must cover unreleased packages, already-published packages, compatibility-breaking contract changes, and mixed-lifecycle monorepos.

## Nx release configuration illustration

The `conventionalCommits.types` mapping MUST explicitly define **all allowed types**, not only `init`. A partial override may change how omitted types are interpreted and cause unintended bumps. Use a complete reviewed baseline, while preserving repository-specific types and deliberate policies:

```json
{
  "release": {
    "version": { "conventionalCommits": true },
    "conventionalCommits": {
      "types": {
        "init": { "semverBump": "none" },
        "feat": { "semverBump": "minor" },
        "fix": { "semverBump": "patch" },
        "perf": { "semverBump": "patch" },
        "refactor": { "semverBump": "patch" },
        "revert": { "semverBump": "patch" },
        "docs": { "semverBump": "none" },
        "chore": { "semverBump": "none" },
        "style": { "semverBump": "none" },
        "test": { "semverBump": "none" },
        "e2e": { "semverBump": "none" },
        "build": { "semverBump": "none" },
        "ci": { "semverBump": "none" }
      }
    }
  }
}
```

Inventory every permitted standard and custom commit type in each repository. Every permitted type MUST have an explicit Nx bump setting; unknown types MUST be rejected by commit validation. This is a policy baseline, not authorization to silently alter pre-existing intentional mappings. Verify breaking-change notation and bump behavior with the installed Nx version and release dry runs.

For **anarchitecture-contracts**, remove version-plan keys and associated workflow automation when implementing this ADR. Nx configuration schema/behavior MUST be verified against the installed Nx version. Merely setting `init` to `none` does not enforce the first release number or prevent publish.

## Rollout

- Inventory names from `nx show projects`, existing package tags and distribution history.
- Update `nx.json`, contributor guidance, release runbooks, agent instructions, commit validation and GitHub Actions as appropriate in implementation PRs.
- For contracts, supersede the workflow portion of ADR-0003 that makes version plans authoritative; preserve its independent releases, contract ownership and compatibility objectives. Update `docs/nx-migration.md` and all version-plan references in the same implementation.
- Dry-run Nx release to verify `init` remains non-bumping and `feat`/`fix` behave correctly, with explicit first-release `0.0.1` checks.
- Do not retroactively change published versions.

## Consequences

All Anarchitects packages follow the same predictable release lifecycle and Conventional Commits authority while retaining domain-specific validation. Extra first-publication checks and contract-impact gates are required; version-plan files no longer serve as an alternative release authority.
