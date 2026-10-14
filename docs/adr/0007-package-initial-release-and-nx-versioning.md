# ADR: Initial package releases and Nx-compatible versioning

- **Status:** Proposed
- **Date:** 2026-10-14
- **Scope:** All Anarchitects versioned/distributed packages
- **Canonical owner:** anarchitecture-meta

## Context

Packages in Nx monorepositories have independent release lifecycles. Initial implementation should not produce automatic version increments. Some workspaces already infer releases from Conventional Commits; anarchitecture-contracts was migrated to Nx version plans to preserve Changesets intentions, without an explicit architectural decision to retain plans permanently. The organization chooses one consistent versioning authority: Conventional Commits, with package-specific quality and compatibility gates.

## Decision

1. **First official distribution release MUST be exactly `0.0.1` per package except when joining an already released Bricks domain**, whether published through npm, GitHub Releases or another distribution channel. The package manifest, release tag and artifact metadata must agree. An additional channel carrying the same already-released version is not a second initial release. Existing published history and tags are not rewritten.
2. **Before its first release, package-specific development MUST use `init(<nx-project-name>): ...`**. The `init` Conventional Commit type MUST be explicitly configured with `semverBump: "none"` in `nx.json`. An `init` commit does not imply or authorize publishing; an explicit release operation must select and verify the first version required by the release alignment strategy.
3. **After first release, use normal Conventional Commits for SemVer** (`feat`, `fix`, breaking-change syntax and configured non-bumping types). Published `0.0.x` packages are already released and cannot use `init` for ordinary changes. A mixed commit touching unreleased and released packages must be split or otherwise produce reviewable, correct per-project release intent.
4. **All scoped Conventional Commits MUST use an actual, exact Nx project name** from the active project graph, not an arbitrary directory, npm scope or release group. For purely repository-wide changes, unscoped commits are allowed. Validate scopes in CI and agent instructions. Nx release-group names are not substitutes for Nx project names.
5. **Independently versioned projects use independent Nx release relationships.** Bricks domain-aligned groups retain independent patch versions but enforce major/minor alignment as specified below.
6. **Nx Conventional Commits are the version-bump authority throughout Anarchitects. Nx version plans are NOT the ongoing workflow.** In particular, **anarchitecture-contracts MUST remove `release.versionPlans`, `version.specifierSource: "version-plans"`, and version-plan creation/consumption requirements**, and enable `release.version.conventionalCommits: true`. Retain its independent projects, package identity and release-tag patterns.
7. **Keep contract-specific compatibility gates.** OpenAPI/contract compatibility, baseline comparisons, and migration-impact review remain required. Gates must assess the actual conventional-commit-derived proposed release version against detected compatibility impact, and reject insufficient bumps. A `fix` that breaks a public HTTP contract cannot silently pass as a patch. Existing pending Changesets/version plans must be assessed and migrated deliberately to preserve meaningful release intent; do not discard pending changes or rewrite published history.
8. **No unapproved first-version exception.** Except for new packages joining an already released Bricks domain, new packages do not start at `0.1.0` or `1.0.0`; official prerelease distribution before initial `0.0.1` is not permitted. Internal non-distributed builds do not count as releases. Existing published prerelease/version histories are grandfathered.
9. **Automated enforcement required.** Commitlint or equivalent must use Nx project graph for scope validation, Nx Release must configure non-bumping `init`, and publication CI must assert correct first-release versions, including the domain-joining exception, against tags and appropriate registries. Tests must cover unreleased packages, already-published packages, compatibility-breaking contract changes, and mixed-lifecycle monorepos.

## Release alignment strategies

**Default: independent package versioning.** Contracts, Community, Plugins and other non-Bricks packages follow independent SemVer, with first distribution at `0.0.1`.

**Exception: domain-aligned versioning in Bricks 3-Tier and Bricks DDD.** Publishable packages belonging to one bounded context MUST have identical `MAJOR.MINOR` values for their latest released versions, while `PATCH` MAY vary per package. Example: `auth-ts@0.12.6`, `auth-nest@0.12.5`, `auth-angular@0.12.3`. Group by bounded context, not by Nest/Angular/TS technology family. Independent Nx release relationships are retained for patch autonomy; they do not alone enforce domain-line synchronization.

- **Patch:** only changed packages need publishing, provided every previously released package remains on the shared major/minor line.
- **Major/minor:** coordinated domain release advances *all previously published packages* of that context to the new major/minor line, including unchanged packages if necessary. Never leave latest released members on different major/minor lines.
- **New domain:** the first distributed package starts at `0.0.1`. Packages of a domain not yet released stay in non-bumping `init` development.
- **New package joining a released domain:** initialization commits remain `init` (non-bumping), but **its first released version joins the domain's current major/minor**, normally `MAJOR.MINOR.0` or an available patch number. This is the sole permitted exception to the general first-version `0.0.1` rule. It must not trigger a domain-wide minor/major bump merely because a new package is added.
- **DDD:** follow the same domain grouping semantics as 3-Tier, despite DDD's finer `ts/domain`, `ts/contracts`, `nest/*`, `angular/*` layout. Only independently distributable/publishable projects participate in public version alignment; internal projects do not need distribution versions.
- **Platform/common packages:** remain independently versioned unless explicitly designated as part of a bounded-context release group.
- **Enforcement:** release validation must inspect the Nx project graph, current published tags/registries, proposed release versions and alignment across all published packages in the domain. Test independent patch and coordinated major/minor releases. Keep Bricks 3-Tier's existing domain Nx release groups; establish corresponding groups for DDD when publishable packages are introduced. Cross-repo 3-Tier/DDD versions need not match each other.

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
