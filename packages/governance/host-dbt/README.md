# anarchitecture-dbt-governance

`anarchitecture-dbt-governance` is a Python CLI for running Anarchitects Governance checks against existing dbt projects. It installs the `dbt-governance` command, runs from a dbt project root or with `--project-dir`, is not a dbt package, is not installed with `dbt deps`, and uses a pinned Node runtime internally.

The CLI reads dbt artifacts, optionally runs `dbt parse` when you allow it, invokes `@anarchitects/governance-runtime-dbt` over a process/JSON boundary, and renders governance output for local use and CI.

## Installation

Use a Python package installer, not `dbt deps`.

`pipx` and `uv tool` are the recommended choices for CLI-style usage:

```bash
pipx install anarchitecture-dbt-governance
```

```bash
uv tool install anarchitecture-dbt-governance
```

Use `pip` when you want the CLI inside a project virtualenv or CI environment:

```bash
pip install anarchitecture-dbt-governance
```

## Requirements

- Python `>=3.9,<4`
- Node.js `>=20 <25`
- An existing dbt project with `dbt_project.yml`
- Existing dbt artifacts, or permission to let the host run `dbt parse`
- Package-manager access to install or verify the pinned runtime package
  `@anarchitects/governance-runtime-dbt@0.1.0`

Notes:

- This package is a Python CLI used alongside dbt.
- It is not a dbt package.
- For the companion dbt package strategy, see [`docs/governance/dbt-companion-package-strategy.md`](../../../docs/governance/dbt-companion-package-strategy.md).
- It is not installed through `packages.yml`.
- It does not use `dbt deps`.
- The runtime executable it manages internally is
  `dbt-governance-runtime`.

## Optional Companion dbt Package

The companion dbt package is optional. `anarchitecture-dbt-governance` remains
the authoritative governance evaluation and reporting path because it provides
the `dbt-governance` CLI, reads dbt artifacts, invokes the runtime, and renders
reports.

The companion dbt package `anarchitects_governance` is a separate dbt-side
enablement layer. It lives inside the dbt project, installs through
`packages.yml` plus `dbt deps`, and provides dbt-native helpers such as
metadata templates, docs blocks, and lightweight metadata tests.

### Installation Model

Install the CLI and the companion package separately:

- CLI: `pipx`, `uv tool`, or `pip`
- companion dbt package: dbt `packages.yml` plus `dbt deps`

Important boundary:

- `dbt deps` does not install `dbt-governance`
- `dbt deps` does not install the Node runtime used by the host
- the companion dbt package does not run the governance engine
- the companion dbt package does not replace `dbt-governance check`
- use the companion package to help author dbt-side governance metadata
- use `dbt-governance check` to evaluate dbt artifacts and generate reports

### Example `packages.yml`

Use a released companion package tag from the release notes. The current repo
tag convention is `<project>@<version>`.

Git/subdirectory install example:

```yaml
packages:
  - git: 'https://github.com/anarchitects/anarchitecture-community.git'
    revision: 'governance-dbt-package@0.0.1'
    subdirectory: 'packages/governance/dbt-package'
```

Local development example:

```yaml
packages:
  - local: ../anarchitecture-community/packages/governance/dbt-package
```

`dbt deps` installs only the companion dbt package from that entry. It does not
install the Python CLI.

### Typical Workflow

```bash
# 1. Install the Python CLI
pipx install anarchitecture-dbt-governance
# or:
uv tool install anarchitecture-dbt-governance

# 2. Add the companion dbt package to packages.yml, then install dbt deps
dbt deps

# 3. Let dbt parse and test the project locally
dbt parse
dbt test

# 4. Run authoritative governance evaluation
dbt-governance check

# 5. Optionally generate reports
dbt-governance report --format markdown --report-path target/governance-report.md
```

### When To Use Which Package

Use only `dbt-governance` when:

- you want to evaluate an existing dbt project from dbt artifacts
- you do not want dbt-side helpers or tests in the project
- you only need governance checks and reports

Use `dbt-governance` plus the companion dbt package when:

- you want dbt-native metadata templates
- you want docs blocks for governance conventions
- you want lightweight dbt metadata tests
- you want to help teams author governance metadata consistently

### Optional Companion Install Helper

`dbt-governance companion install` is an optional convenience command for
printing or updating the companion package entry in `packages.yml`.

Print the Git-based install fragment only:

```bash
dbt-governance companion install --print
```

Create or update `packages.yml` explicitly:

```bash
dbt-governance companion install \
  --write \
  --revision governance-dbt-package@0.0.1
```

Optionally run `dbt deps` after a successful write:

```bash
dbt-governance companion install \
  --write \
  --revision governance-dbt-package@0.0.1 \
  --run-dbt-deps
```

The helper defaults to a safe dry-run mode when `--write` is omitted. It can:

- print the YAML fragment
- create a new `packages.yml`
- append the companion package entry to an existing `packages.yml`
- avoid duplicate Git/subdirectory entries

Companion package docs:

- [Companion package README](../dbt-package/README.md)
- [Companion package strategy](../../../docs/governance/dbt-companion-package-strategy.md)
- [dbt Governance host reference](../../../docs/governance/dbt-governance-host.md)

It does not claim dbt Hub availability. The Git tag / release flow is tracked in
[#461](https://github.com/anarchitects/anarchitecture-community/issues/461).

## Quickstart

From an existing dbt project root:

```bash
dbt-governance init
dbt-governance setup
dbt parse
dbt-governance check
```

If you want the host to generate `manifest.json` when it is missing:

```bash
dbt-governance check --parse
```

If you want to point at a project explicitly:

```bash
dbt-governance check --project-dir ./path/to/dbt/project
```

Generate reports:

```bash
dbt-governance check --report-path target/governance-report.json
dbt-governance report --format markdown --report-path target/governance-report.md
```

## What The CLI Does

The host lifecycle is:

1. Resolve the dbt project from the current directory or `--project-dir`.
2. Load `governance.yml` if present, or use host defaults.
3. Resolve dbt artifact path hints such as `manifest.json` and `catalog.json`.
4. Use existing artifacts, or optionally run `dbt parse` when `manifest.json` is missing and `--parse` or `host.artifactMode: use-existing-or-parse` allows it.
5. Verify or install the pinned runtime package `@anarchitects/governance-runtime-dbt@0.1.0`.
6. Invoke `dbt-governance-runtime` through a process/JSON boundary.
7. Render human output to stdout, machine-readable JSON to stdout, or write JSON/markdown reports.
8. Map the result to deterministic exit codes.

## Configuration Overview

`dbt-governance` distinguishes two kinds of configuration:

- `governance.yml`: host-local configuration for CLI behavior, dbt artifact lifecycle, runtime setup, routing, output, and CI behavior.
- Governance profile content: runtime/core/extension-owned semantics such as layers, ownership, domains, metrics, and rule configuration.

Current implementation detail:

- The host validates `profile.path` as a string and `profile.document` as an object.
- The runtime evaluates `profile.document`.
- `profile.path` is forwarded as metadata and path context, but the current host/runtime path does not load a separate `governance.profile.yml` file for semantic evaluation.

Practical consequence:

- Put effective governance profile content under `profile.document` today.
- If you also keep a separate `governance.profile.yml` in your repository, treat it as your own companion file and keep it in sync yourself.

Config precedence is:

`CLI flags > governance.yml > host defaults`

Default config lookup:

- With `--config`, the CLI loads that explicit file.
- Without `--config`, the CLI looks for `governance.yml` in `--project-dir` when provided.
- Otherwise it looks in the current working directory.

## governance.yml Reference

Allowed top-level sections:

- `profile`
- `adapter`
- `extension`
- `runtime`
- `host`

Example:

```yaml
profile:
  path: governance.profile.yml
  document:
    name: dbt
    layers:
      - staging
      - intermediate
      - marts
    allowedDomainDependencies:
      customer:
        - customer
      finance:
        - finance
      sales:
        - sales
    ownership:
      required: true
    health:
      statusThresholds:
        goodMinScore: 85
        warningMinScore: 70
    metrics: {}
    rules:
      ownership-presence:
        enabled: true
        severity: warning
        options:
          required: true
      documentation-gap:
        enabled: true
        severity: warning
        options:
          metadataKeys:
            - documentation
          requireAny: true

adapter:
  paths:
    projectDir: .
    dbtProjectPath: dbt_project.yml
    targetPath: target
    manifestPath: target/manifest.json
    catalogPath: target/catalog.json
    runResultsPath: target/run_results.json
    sourcesPath: target/sources.json
  options:
    validationMode: strict

extension:
  options: {}

runtime:
  cacheDir: .anarchitecture/dbt-governance/runtime
  reportPath: target/governance-report.json

host:
  artifactMode: use-existing-or-parse
  output: human
  ci:
    failOnBlockingViolations: true
```

### `profile`

- `path`: optional string path hint. The host validates and forwards it, but does not load that file for semantic evaluation.
- `document`: optional object. This is the effective governance profile input used by the runtime.

The host only validates that `profile.document` is an object. Profile semantics are owned by the runtime, core, and dbt extension.

### `adapter.paths`

- `projectDir`: optional project directory override.
- `dbtProjectPath`: optional path to `dbt_project.yml`.
- `targetPath`: optional target directory override. Default dbt artifact directory is `target/`.
- `manifestPath`: optional path to `manifest.json`.
- `catalogPath`: optional path to `catalog.json`.
- `runResultsPath`: optional path to `run_results.json`.
- `sourcesPath`: optional path to `sources.json`.

These are path hints passed through to the dbt adapter/runtime boundary. The host performs lightweight path checks only.

### `adapter.options`

- `validationMode`: confirmed supported adapter option. Allowed values are `strict` and `lenient`.

`adapter.options` is adapter-owned and routed to `@anarchitects/governance-adapter-dbt`.

### `extension.options`

`extension.options` is extension-owned and routed unchanged to `@anarchitects/governance-extension-dbt`.

For end users, the stable configuration surface today is primarily:

- dbt metadata inside your dbt project
- governance profile rules under `profile.document.rules`

The host does not validate extension-owned option keys beyond requiring `extension.options` to be an object.

### `runtime`

- `cacheDir`: optional runtime cache directory.
- `reportPath`: optional default report output path.

If `runtime.cacheDir` is omitted, the host uses a controlled cache under the user cache directory. The runtime is installed locally there, not globally.

### `host`

- `artifactMode`: one of `require-existing`, `use-existing-only`, `use-existing-or-parse`
- `output`: one of `human`, `json`
- `ci.failOnBlockingViolations`: boolean

Behavior:

- default host values are `artifactMode: require-existing`, `output: human`, and `ci.failOnBlockingViolations: true`
- `require-existing`: `manifest.json` must already exist.
- `use-existing-only`: use existing artifacts and never invoke `dbt parse`.
- `use-existing-or-parse`: use existing artifacts when available; otherwise invoke `dbt parse`.

## governance.profile.yml Reference

The governance profile is the semantic input that drives core and dbt-specific governance behavior.

Current implementation note:

- `profile.document` is the active evaluated profile input.
- A separate `governance.profile.yml` file is not automatically loaded by the current host/runtime path.
- If you keep `governance.profile.yml` in your repository, treat the schema below as the content you must mirror into `profile.document`.

Example effective profile document:

```yaml
name: dbt
layers:
  - staging
  - intermediate
  - marts
allowedDomainDependencies:
  customer:
    - customer
  finance:
    - finance
  sales:
    - sales
ownership:
  required: true
health:
  statusThresholds:
    goodMinScore: 85
    warningMinScore: 70
metrics: {}
rules:
  ownership-presence:
    enabled: true
    severity: warning
    options:
      required: true
  documentation-gap:
    enabled: true
    severity: warning
    options:
      metadataKeys:
        - documentation
      requireAny: true
```

Confirmed profile fields evaluated by the runtime today:

- `name`
- `description`
- `layers`
- `allowedDomainDependencies`
- `ownership.required`
- `health.statusThresholds.goodMinScore`
- `health.statusThresholds.warningMinScore`
- `metrics`
- `rules`

If `profile.document` is omitted entirely, the runtime defaults to:

- `name: dbt`
- `layers: ["staging", "intermediate", "marts"]`
- `allowedDomainDependencies: {}`
- `ownership.required: true`
- `health.statusThresholds.goodMinScore: 85`
- `health.statusThresholds.warningMinScore: 70`
- `metrics: {}`

Important honesty point:

- `allowedLayerDependencies` exists in the canonical core profile model, but this host/runtime path does not currently parse it from `profile.document`.
- For layer behavior today, prefer `layers` plus explicit rule configuration such as `dbt/no-disallowed-layer-dependency` and `layer-boundary`.

If a profile field is not listed above, assume it is not part of the stable evaluated surface for this CLI path yet.

## Core Rules Vs dbt-Specific Rules

Reports can contain both canonical core rules and dbt-specific extension rules.

Core rules come from `@anarchitects/governance-core` and operate on normalized governance nodes and relations:

- `ownership-presence`
- `documentation-gap`
- `layer-boundary`
- `domain-boundary`
- `missing-domain`
- `missing-layer`
- `project-name-convention`
- `tag-convention`

dbt-specific rules come from `@anarchitects/governance-extension-dbt` and operate on dbt-specific metadata interpretation:

- `dbt/no-disallowed-layer-dependency`
- `dbt/no-mart-to-mart-dependency`
- `dbt/critical-models-require-owner`
- `dbt/public-models-require-description`
- `dbt/critical-models-require-tests`
- `dbt/public-models-require-contract`
- `dbt/cross-domain-dependencies-require-approval`

Use core rules for canonical governance expectations. Use dbt rules for dbt-specific semantics such as dbt descriptions, tests, contracts, and dbt lineage approval metadata.

## Ownership Semantics

`ownership-presence` is a core rule.

- Source: `@anarchitects/governance-core`
- Rule ID: `ownership-presence`
- Category: `ownership`
- Default severity: `warning`
- Active when ownership is required by profile defaults or rule options

What it checks:

- canonical node ownership data, not raw dbt YAML directly
- a node passes when it has `node.ownership.team`
- a node also passes when it has at least one `node.ownership.contacts` entry

If both are missing, the rule emits a violation such as:

```text
Node dim_customers has no canonical ownership metadata or configuration.
```

dbt-specific caveat:

- `meta.owner` only helps if the adapter/runtime path maps it into canonical ownership.
- Raw dbt metadata existing does not automatically mean the core rule passes.
- dbt-specific ownership diagnostics and rules are separate from the core rule.

Enable explicitly:

```yaml
profile:
  document:
    rules:
      ownership-presence:
        enabled: true
        severity: warning
        options:
          required: true
```

Disable explicitly:

```yaml
profile:
  document:
    rules:
      ownership-presence:
        enabled: false
```

## Documentation Semantics

`documentation-gap` is a core rule.

- Source: `@anarchitects/governance-core`
- Rule ID: `documentation-gap`
- Category: `documentation`
- Default severity: `warning`
- Default options:
  - `metadataKeys: ["documentation"]`
  - `requireAny: true`

What it checks:

- canonical node metadata, not dbt `description:` directly
- by default a node is considered documented when `node.metadata.documentation === true`
- it also passes when `node.metadata.documentation === "true"`

If no configured metadata key is present, the rule emits a violation such as:

```text
Missing documentation metadata for node fct_orders.
```

Important distinction:

- dbt `description:` is not automatically the same thing as canonical `node.metadata.documentation` for the core rule.
- dbt-specific description checks are separate, especially `dbt/public-models-require-description`.
- The dbt extension can derive dbt documentation facts for dbt-specific behavior, but the core rule still evaluates canonical metadata keys.

Enable explicitly:

```yaml
profile:
  document:
    rules:
      documentation-gap:
        enabled: true
        severity: warning
        options:
          metadataKeys:
            - documentation
          requireAny: true
```

Disable explicitly:

```yaml
profile:
  document:
    rules:
      documentation-gap:
        enabled: false
```

## Layer Governance Semantics

`staging -> intermediate -> marts` is an Anarchitects governance default inspired by common dbt conventions. It is not a dbt platform default, and dbt itself does not enforce those layers.

The current runtime defaults to these layers when the profile does not define them:

- `staging`
- `intermediate`
- `marts`

Related rules:

- dbt-specific rule: `dbt/no-disallowed-layer-dependency`
- core rule: `layer-boundary`

Default upstream behavior for the dbt-specific rule:

- `staging` may depend on `staging`
- `intermediate` may depend on `staging` and `intermediate`
- `marts` may depend on `intermediate` and `marts`

For custom layer names, the dbt rule uses the order from `profile.document.layers`. If you want to remove ambiguity, set `allowedUpstreamByLayer` explicitly.

Example:

```yaml
profile:
  document:
    name: dbt
    layers:
      - staging
      - intermediate
      - marts
    rules:
      dbt/no-disallowed-layer-dependency:
        enabled: true
        severity: error
        options:
          allowedUpstreamByLayer:
            staging:
              - staging
            intermediate:
              - staging
              - intermediate
            marts:
              - intermediate
              - marts
```

`dbt/no-mart-to-mart-dependency` can be configured independently:

```yaml
profile:
  document:
    rules:
      dbt/no-mart-to-mart-dependency:
        enabled: true
        severity: warning
        options:
          martLayers:
            - marts
```

## dbt Metadata Conventions

The dbt adapter/extension path can derive governance facts from normalized dbt metadata. Supported conventions today include:

- `description:` for dbt-specific description/documentation behavior
- `meta.domain`
- `meta.layer`
- `meta.owner`
- `meta.governed`
- `meta.public`
- `meta.criticality`
- `tags: ["layer:<name>"]`
- `tags: ["public"]`
- `tags: ["published"]`
- `tags: ["governed"]`
- contract metadata preserved through dbt validation metadata
- test presence preserved through dbt validation metadata

Supported ownership mapping sources include:

- canonical `node.ownership.team`
- `metadata.dbt.resource.owner`
- `metadata.dbt.resource.group`
- `metadata.dbt.resource.meta.owner`

Supported domain mapping sources include:

- canonical `node.classification.domain`
- `metadata.dbt.resource.meta.domain`

Supported layer mapping sources include:

- canonical `node.classification.layer`
- `metadata.dbt.resource.meta.layer`
- `layer:<name>` tags
- supported path conventions for common dbt layer folders

Supported public/governed interface markers include:

- `meta.public: true`
- `meta.governed: true`
- tags `public`, `published`, or `governed`

Supported criticality mapping:

- `meta.criticality: "high"` or another non-empty string

Supported cross-domain approval metadata paths for
`dbt/cross-domain-dependencies-require-approval`:

- `dbt.governance.crossDomainApproved`
- `dbt.lineage.crossDomainApproved`
- `dbt.lineage.approved`

Truth-like approval values accepted there include `true`, `"true"`, `"approved"`, and `"yes"`.

Example dbt model configuration:

```yaml
models:
  - name: customer_public_mart
    description: Public customer mart for downstream analytics
    tags:
      - layer:marts
      - public
    meta:
      domain: customer
      layer: marts
      owner: analytics-engineering
      public: true
      criticality: high
      governance:
        crossDomainApproved: true
    config:
      contract:
        enforced: true
```

Important distinction:

- dbt metadata helps the adapter/extension derive governance facts.
- Core rules still evaluate canonical governance fields after normalization.
- If your dbt project carries metadata but a canonical core rule still fails, check whether the relevant canonical field was actually derived.

## Commands Reference

### `dbt-governance init`

Creates a starter `governance.yml`.

Options:

- `--project-dir`
- `--config`
- `--force`

Behavior:

- writes a starter config
- refuses to overwrite an existing config by default
- overwrites only when `--force` is set

### `dbt-governance setup`

Installs or verifies the pinned Node runtime package in the controlled cache.

Options:

- `--config`

### `dbt-governance doctor`

Reports host, config, Node, package-manager, runtime-manifest, and installed runtime status.

Options:

- `--config`

### `dbt-governance check`

Runs the host lifecycle, invokes the runtime, renders a result, and exits with a governance-aware process code.

Options:

- `--project-dir`
- `--profiles-dir`
- `--target`
- `--target-path`
- `--config`
- `--use-existing-artifacts`
- `--parse`
- `--json`
- `--report-path`

Notes:

- `--json` writes the machine-readable report JSON to stdout only.
- `--report-path` writes a machine-readable JSON report file.

### `dbt-governance report`

Runs the same lifecycle as `check`, then renders the result as `json` or `markdown`.

Options:

- `--project-dir`
- `--profiles-dir`
- `--target`
- `--target-path`
- `--config`
- `--use-existing-artifacts`
- `--parse`
- `--format json`
- `--format markdown`
- `--report-path`

Notes:

- `report` re-runs the governance lifecycle; it is not a converter for an existing report file.
- If `--format` is omitted, the default is `json` when `host.output` is `json`, otherwise `markdown`.

## dbt Artifact Lifecycle

Artifact behavior today:

- `manifest.json` is required
- optional artifacts are `catalog.json`, `run_results.json`, and `sources.json`
- the default target directory is `target/`
- an existing `manifest.json` is preferred
- `--parse` runs `dbt parse` only when `manifest.json` is missing
- `--use-existing-artifacts` never invokes dbt
- the host performs lightweight path checks only
- the runtime/adapter own artifact loading, validation, normalization, and dbt-to-governance mapping

When the host invokes dbt, it runs:

```bash
dbt parse --project-dir <project-dir> [--profiles-dir ...] [--target ...] [--target-path ...]
```

## Runtime Setup

Pinned runtime metadata:

- package: `@anarchitects/governance-runtime-dbt`
- version: `0.1.1`
- executable: `dbt-governance-runtime`
- Node range: `>=20 <25`

Operational behavior:

- `dbt-governance setup` installs or verifies that exact runtime version
- `dbt-governance doctor` reports compatibility and runtime state
- the runtime is installed in a controlled cache
- there is no global runtime install
- the host does not install `latest`
- incompatible or mismatched runtime metadata is treated as a tooling/runtime failure, not a governance finding

## Output Modes And Reports

Supported output behavior:

- default `check` output is human-readable text
- `check --json` emits structured JSON to stdout
- `check --report-path <file>` writes a JSON report envelope to a file
- `report --format json` renders JSON
- `report --format markdown` renders markdown

The structured JSON output can include host metadata, diagnostics, result data, runtime metadata, and resolved artifact information when available.

## CI Usage

Example GitHub Actions workflow:

```yaml
name: dbt-governance

on:
  pull_request:
  push:
    branches: [main]

jobs:
  governance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install dbt Governance host
        run: pip install anarchitecture-dbt-governance

      - name: Install dbt dependencies if needed
        run: dbt deps

      - name: Build dbt artifacts
        run: dbt parse

      - name: Install pinned governance runtime
        run: dbt-governance setup

      - name: Run governance checks
        run: dbt-governance check --report-path target/governance-report.json

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: governance-report
          path: target/governance-report.json
```

`host.ci.failOnBlockingViolations` controls whether blocking violations produce exit code `1` or whether the check still exits successfully with `0`.

## Exit Codes

- `0`: successful check with no blocking violations, or blocking violations are allowed because `host.ci.failOnBlockingViolations=false`
- `1`: successful check with blocking violations when `host.ci.failOnBlockingViolations=true`
- `2`: host, dbt, runtime setup, or runtime invocation failure
- `3`: unsupported or incompatible runtime or contract

Interpretation:

- exit code `1` is a governance failure
- exit codes `2` and `3` are tooling, runtime, or environment failures

## Troubleshooting

### `dbt-governance: command not found`

The package is not installed in the active environment, or the CLI script directory is not on `PATH`. Reinstall with `pipx`, `uv tool`, or `pip`, then confirm `dbt-governance --help` works.

### Package installed but command still not on `PATH`

This is usually a Python environment or shell path issue. Prefer `pipx` or `uv tool` for CLI usage, or activate the correct virtualenv before invoking the command.

### `dbt_project.yml` not found

Run the CLI from the dbt project root or pass `--project-dir` to the dbt project directory.

### `manifest.json` not found

Generate artifacts first with `dbt parse`, or rerun `dbt-governance check --parse`, or switch `host.artifactMode` to `use-existing-or-parse`.

### `dbt` executable not found

The host can only run `dbt parse` when a `dbt` executable is available on `PATH`. Install dbt or avoid parse mode by supplying existing artifacts.

### `dbt parse` failed

Fix the underlying dbt project, target, or profile problem first. The host surfaces dbt stdout and stderr details through diagnostics.

### dbt profile not found

If `dbt parse` needs a non-default profiles directory or target, pass `--profiles-dir` and `--target`.

### Unsupported Node version

Install a Node version in the supported range `>=20 <25`. Node 22 is a safe choice for CI.

### `npm` or runtime package-manager access unavailable

The host must be able to verify or install the pinned runtime package. Ensure `npm` is available on `PATH` and can install packages in the local runtime cache.

### Runtime package install failed

Check Node, package-manager availability, registry access, and local cache directory permissions. Re-run `dbt-governance doctor` to confirm compatibility details.

### Runtime executable missing

Run `dbt-governance setup` again. If the package installs but the executable is still missing, inspect the runtime cache and `doctor` output.

### Invalid runtime JSON output

The runtime process must emit a single JSON object on stdout. This is a runtime/tooling failure and exits with code `2`.

### Incompatible runtime metadata

If the runtime reports a different package or version than the pinned manifest expects, the host exits with code `3`.

### Invalid `governance.yml`

The host validates YAML syntax, top-level shape, supported top-level sections, and section types. Regenerate with `dbt-governance init --force` if needed, then reapply your changes carefully.

### Blocking violations fail CI

That is expected when `host.ci.failOnBlockingViolations=true`. Set it to `false` only if you intentionally want governance findings to be non-blocking.

### dbt descriptions exist but `documentation-gap` still appears

`documentation-gap` is a core rule that checks canonical metadata keys such as `documentation`, not raw dbt `description:` directly. A dbt description can still satisfy dbt-specific rules while the core rule remains active.

### dbt owner metadata exists but `ownership-presence` still appears

`ownership-presence` checks canonical ownership fields such as `node.ownership.team` or `node.ownership.contacts`. Raw dbt ownership metadata only helps if the adapter/extension path resolves it into those canonical fields.

## Architecture Boundary

```text
dbt project
  -> dbt artifacts
  -> dbt-governance Python host
  -> dbt-governance-runtime process/JSON boundary
  -> governance runtime
  -> governance adapter/extension/core
  -> reports
```

Responsibility split:

- the host owns CLI UX, artifact lifecycle orchestration, runtime setup, invocation, rendering, and exit codes
- the runtime owns TypeScript composition
- the adapter owns dbt artifact loading, validation, normalization, and generic canonical projection
- the extension owns dbt-specific interpretation, rules, signals, diagnostics, metrics, and recommendations
- core owns canonical governance contracts and built-in rules

## Development

For workspace development inside this monorepo:

```bash
yarn nx run governance-host-dbt:lint
yarn nx run governance-host-dbt:test
yarn nx run governance-host-dbt:e2e
yarn nx run governance-host-dbt:build
```

## Links

- PyPI: https://pypi.org/project/anarchitecture-dbt-governance/
- npm runtime: https://www.npmjs.com/package/@anarchitects/governance-runtime-dbt
- Repository: https://github.com/anarchitects/anarchitecture-community
- Runtime package docs: [packages/governance/runtime-dbt/README.md](../runtime-dbt/README.md)
- dbt adapter docs: [packages/governance/adapter-dbt/README.md](../adapter-dbt/README.md)
