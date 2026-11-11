# Contributing

## Purpose

This repository hosts community integration packages for the Anarchitects ecosystem.

Use [OWNERSHIP.md](OWNERSHIP.md) to identify the responsible package owner and
technical maintainer. The [Community SDLC operating model](docs/sdlc.md) applies
the agreed ecosystem delivery, acceptance and release-authority rules locally.

The current package families are:

- Better Auth TypeORM integration (Auth)
- Nest Angular SSR integration (SSR)
- Governance Core, adapters, extensions, CLI, dbt runtime and Python/dbt hosts
- Editor.js authoring, tools, uploads and HTML rendering (Visual Composition)

Use the [ownership inventory](OWNERSHIP.md#package-inventory) for exact project and
distribution names. Fixture apps and repository tooling support these packages;
they are not separately released application products.

Contributions should improve package quality, maintainability, and reuse without expanding scope unnecessarily.

## Intake, planning and acceptance

Choose a bug report, feature request or operational work item in the
[issue chooser](https://github.com/anarchitects/anarchitecture-community/issues/new/choose).
State the expected outcome, affected packages or repository area, scope and how
the result can be verified. Link relevant evidence and dependencies. If known,
identify the accountable Owner and Domain/Capability from OWNERSHIP.md; reporters
may leave ownership for maintainer triage. Reporting a problem does not require
knowing our internal process or committing to implement it.

Keep small changes small: link existing issue detail instead of repeating it in a
PR. Discuss substantial public API, boundary, dependency or architectural changes
before implementation. Operational work can promise documentation, a decision,
live settings, publication or adoption; state which result is actually needed.

Apply the [local operating model](docs/sdlc.md#from-work-item-to-accepted-outcome)
and Meta's [canonical statuses and fields](https://github.com/anarchitects/anarchitecture-meta/blob/main/docs/sdlc.md#planning-structure):

- **Backlog → Ready:** the maintainer and relevant owner clarify scope, acceptance,
  ownership and prerequisites enough for execution to start. An unresolved
  necessary prerequisite prevents Ready.
- **In Progress → In Review:** record active work, then link the reviewable result
  and evidence. The maintainer reviews technical readiness; the relevant owner
  accepts the promised outcome, even when the same person holds both roles.
- **Blocked:** identify the dependency, responsible owner and next action. When it
  resolves, clear **Blocked by** and reassess Ready or resume In Progress. Closed
  prerequisites do not automatically reconcile project fields.
- **Done:** record acceptance of the agreed result. A merged implementation may
  satisfy an implementation issue; it does not establish publication or adoption.
  Keep those linked when separately tracked. If this issue promises a live result,
  obtain evidence of that live result before acceptance.
- **Cancelled:** record why work deliberately stopped; do not represent it as Done.

Maintain execution metadata in [project #16](https://github.com/orgs/anarchitects/projects/16).
**Owner** is accountable for the work; Assignees identify people doing it.
**Domain/Capability** identifies functional scope. **Priority**, **Target release**
and **Iteration** reflect agreed planning, not commitments inferred from a request.
Leave inapplicable or unagreed values unset. An iteration does not delay capability
releases until sprint end. Templates collect intake context; they do not set or
synchronize these fields. Johan reconciles source issues and selected overview
items as described in the [planning migration](docs/sdlc-planning-migration-717.md).

## Architecture preflight

Before generating or editing code, configuration, templates, examples or tests,
enumerate and read **all** [Meta ADRs](https://github.com/anarchitects/anarchitecture-meta/tree/main/adr)
and all repository ADRs, including [docs/adr](docs/adr/) and any other ADR location.
Read every status, apply accepted decisions and relevant engineering guides,
record applicable constraints and conflicts, and repeat when scope changes. If a
source is inaccessible, report the blocker before generating code. Proposals do
not override accepted decisions; the merged contribution-governance proposal does
not grant new authority. [AGENTS.md](AGENTS.md) retains the full agent obligations.

For Angular work, read the [Modern Angular guide](docs/guides/modern-angular/README.md),
its [repository application](docs/guides/modern-angular/repository-application.md)
and affected topic guides. Preserve published compatibility until a reviewed
migration changes it.

## Principles

- Keep public APIs small and intentional.
- Prefer explicit contracts over magic behavior.
- Do not leak framework internals into package public surfaces unless that is the package’s explicit job.
- Optimize for reusable library design, not app-specific shortcuts.
- Keep dependencies minimal and justified.
- Treat examples as validation surfaces, not product code.

## Workspace Expectations

This repo is an Nx workspace for publishable libraries.

General expectations:

- source code lives under `packages/`
- shared tooling lives under `tools/`
- documentation and design notes live under `docs/`
- fixture apps live under `apps/`; examples and fixtures validate package integration

## Package Design Guidelines

### Easy mode and advanced mode

When relevant, packages should support both:

- easy mode:
  a small, straightforward entry point for common usage
- advanced mode:
  more composable APIs for targeted overrides and integration

### Typed configuration

Prefer:

- typed options
- explicit initialization APIs
- deterministic option precedence

Avoid:

- hidden environment reads inside core logic
- global mutable configuration
- implicit side effects during import

### Dependency boundaries

- keep framework-specific code inside the package that owns that integration
- do not couple unrelated packages unnecessarily
- avoid circular dependencies
- do not introduce cross-package leakage just to reduce a few lines of code

## Better Auth TypeORM Adapter Rules

- Do not force reuse of arbitrary application entities.
- Keep Better Auth persistence concerns explicit.
- Do not expose Better Auth schema tables as shared application domain models.
- Keep TypeORM mapping and Better Auth contract adaptation clearly separated.
- Prefer correctness and contract clarity over premature flexibility.

## Nest Angular SSR Adapter Rules

- Do not try to recreate deprecated APIs blindly.
- Prefer modern Angular SSR and current Nest modular patterns.
- Keep setup explicit.
- Support straightforward default usage, but preserve composition hooks for advanced consumers.
- Document platform limitations clearly.

## Governance and Editor.js boundaries

Follow the [Governance contributor guide](docs/governance-boundary-contributor-guide.md)
for Core/adapter/extension/host responsibilities and configuration ownership.
Keep Nx-specific integration outside Community runtime packages.

Editor.js neutral contracts, browser authoring, Angular integration, uploads and
HTML rendering have separate package responsibilities. Keep browser authoring out
of server evaluation and public display bundles. Follow
[ADR0008](docs/adr/0008-editorjs-html-rendering.md) for rendering safety and the
package READMEs for supported public contracts; hosts retain persistence and
publication authority.

## Code Style

- Follow the package's language and tooling (TypeScript, Python or dbt as applicable).
- Prefer clear names over clever abstractions.
- Keep files focused.
- Add brief comments only where the code would otherwise be hard to follow.
- Avoid large implicit utility layers unless they clearly reduce complexity.

## Tests

All meaningful changes should include appropriate validation.

Typical expectations:

- unit tests for public behavior
- integration tests for framework boundaries
- regression tests for fixed bugs
- example validation when the package depends on real composition behavior

Use Yarn and the installed Nx version. Inspect the affected project's resolved
targets before selecting validation:

```bash
yarn nx show project nest-angular-ssr --json
yarn nx run-many -t lint,typecheck,test,build -p nest-angular-ssr
```

The example is package-scoped; choose the actual affected project and its existing
targets. Run relevant contract, integration and packed-consumer checks when changing
those seams. For documentation/templates, check formatting, links and template
behavior without unrelated runtime suites. Report what ran, what passed, what was
not run and why. Local evidence does not prove remote restoration or Nx DTE.

Preserve declared Nx inputs, outputs, dependency ordering and safe caching. Follow
[Meta0015](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0015-nx-task-caching-and-distributed-execution.md)
and documented cache/DTE exceptions. Agent-driven CI monitoring, reruns, hosted
experiments, extra workers or discretionary credit spending require explicit
maintainer permission. A task-start instruction is not blanket permission to
trigger paid CI; obtain permission for a push/PR that starts it unless already
authorized for that change.

CI uses affected selection and a required `main` aggregate. See the
[main branch protection and CI contract](docs/main-branch-protection.md) for
intentional skips, required-check identity, current safeguards and the dated
settings review. Reconcile protection whenever changing that contract.

## Release authority and current routes

Contributor review and merge establish the implementation's technical readiness
under the [CI/protection contract](docs/main-branch-protection.md). The relevant
owner in OWNERSHIP.md separately accepts scope and authorizes capability release.
A maintainer role, dispatch access or green CI does not grant that authority.
Community capabilities are continuously releasable, without publishing every merge.

Under [Meta0017](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0017-release-cadence-and-owner-authority.md)
and [Meta #49](https://github.com/anarchitects/anarchitecture-meta/pull/49), the
owner **or an authorized bot** may create capability/domain tags. Only the relevant
App PO creates application tags, including hotfix tags. Automation executes the
approved release; it does not choose release intent independently. Each owner
sets applicable controls while retaining existing mandatory safeguards; there is
no new universal release checklist or two-person review requirement.

The checked-in routes are:

- [Release (Manual)](.github/workflows/release.yml): manual dispatch on `main`,
  selecting Nx projects and release inputs; the bot-assisted Nx release runs with
  publishing skipped and creates the configured release records.
- [Publish](.github/workflows/publish.yml): triggered by **`release.published`**,
  or manual dispatch with an existing `<nx-project-name>@<version>` tag. It checks
  out that tag, runs its selected validation and publishes through Nx. **A tag push
  alone does not trigger this workflow.** npm uses trusted publishing/OIDC; registry
  onboarding and any manual first-publication/recovery route need separate review.
- Governance's Python host and dbt package have their own distribution behavior;
  do not apply npm bootstrap assumptions to them. See
  [Governance release conventions](docs/governance-release-conventions.md) for
  package sequencing and runtime/host version alignment, alongside the actual
  Publish workflow and project targets.

Use [ADR0007](docs/adr/0007-package-initial-release-and-nx-versioning.md) for
independent Conventional Commit versioning and first-release history checks.
The first Community distribution must be `0.0.1`; do not reuse first-release mode
for an already published package or overwrite published history. A workflow input
accepting a version or release flag does not make every value policy-compliant.

These are current execution paths, not proof of enforced owner authorization.
The [#719 release-control design](docs/release-controls.md) records the owner-accepted
owner handoff, immutable evidence and recovery controls; its
[dated inventory](docs/release-controls-inventory-719.md) distinguishes observed
settings from verification gaps. Design acceptance does not establish implemented
protection. [Commit/version validators](docs/release-version-policy.md) cover #720;
full release execution and permission enforcement remain #721–#722.
[#719](https://github.com/anarchitects/anarchitecture-community/issues/719) owns
accepted controls and the complete release/retry/recovery handoff;
[#720](https://github.com/anarchitects/anarchitecture-community/issues/720),
[#721](https://github.com/anarchitects/anarchitecture-community/issues/721) and
[#722](https://github.com/anarchitects/anarchitecture-community/issues/722) own
version enforcement, automation and permissions. Follow that accepted design as
it lands; this contributor guide does not authorize dispatch, tagging or publication.

## Documentation

Follow the [public package documentation policy](docs/adr/0004-public-package-documentation.md).
Every publishable package needs its own consumer-facing README, usable from its
registry without private repository context. Public API and behavior changes must
update it in the same PR. Verify the intended README in the actual packed artifact
when preparing a release; source-tree presence alone is insufficient. Keep issue
chronology, fixture instructions and implementation notes in contributor docs.

At minimum, keep in sync:

- package README content
- usage examples
- important limitations
- configuration contracts
- migration notes when behavior changes

## Commit and PR Guidance

Use Conventional Commits. A scope must be an exact Nx project name, not an npm
scope, directory or release-group name; repository-wide changes may be unscoped.
Before a package's first release use `init(<nx-project-name>): ...` (non-bumping).
After publication, including `0.0.x`, use normal version intent (`feat`, `fix`,
breaking-change notation and configured non-bumping types). Split mixed lifecycle
changes when needed to keep per-package intent reviewable. See
[ADR0007](docs/adr/0007-package-initial-release-and-nx-versioning.md) and the
[enforcement guide](docs/release-version-policy.md) for allowed types, PR-message
validation, local commands and limitations. Nx's `0.x` adjustment remains enabled:
features/fixes increment patch and breaking changes increment minor until an
explicit owner decision to release `1.x`.

Examples:

- feat(better-auth-typeorm-adapter): add account repository mapping
- refactor(nest-angular-ssr): simplify render bootstrap contract
- docs: clarify adapter ownership boundaries

Use the [PR template](.github/pull_request_template.md) to link the outcome and
acceptance criteria, explain behavior and compatibility impact, and summarize
validation and remaining work. Link the applicable ADR review and owner decision
where relevant. For small changes, concise evidence or a link is enough.

Reviewers assess the promised result, public contracts/README, meaningful validation
and unresolved blockers. Use `Closes #...` only when this PR satisfies the whole
issue outcome and its acceptance is part of review; otherwise use `Refs #...` and
keep the remainder explicit. Merging or closing does not automatically mark the
project item Done. Record the relevant owner's acceptance and reconcile the board;
review, release authorization and publication remain distinct actions.

## Breaking Changes

Breaking changes are allowed only when justified, explicit, and documented.

If a change breaks public usage:

- call it out clearly
- document migration impact
- avoid mixing unrelated breaking changes into the same PR

## Dependency Additions

Add dependencies only when they are clearly necessary. Under
[Meta0014](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0014-renovate-and-dependabot-dependency-management.md),
Renovate handles routine updates and Dependabot handles security updates. Both
require human review and merge; no automerge. Check compatibility and version
intent even when a bot labels a change `chore`. Dependency updates do not authorize
framework migrations or releases.

Before adding one, check:

- is it required for package purpose
- does Nx or the existing toolchain already cover this need
- can the same result be achieved with less dependency weight
- does it create long-term maintenance burden

## Scope Control

Please avoid contributions that:

- mix unrelated features in one PR
- add app-specific behavior to library code
- expand public API without a real consumer need
- introduce broad abstractions before the concrete use case is proven

## Discussion First

For large changes, open an issue or start a discussion before implementation.

This is especially important for:

- public API design
- package extraction boundaries
- adapter ownership decisions
- major dependency changes
- architectural refactors

## License

By contributing, you agree that your contributions will be released under the repository’s license.
