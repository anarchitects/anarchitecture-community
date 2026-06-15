# anarchitecture-dbt-governance

Build it like an Nx product. Use it like a dbt tool.

`anarchitecture-dbt-governance` is a dbt-native Python CLI for running
Anarchitects Governance checks against an existing dbt project. It manages dbt
artifact lifecycle, resolves the pinned Node runtime, invokes
`@anarchitects/governance-runtime-dbt` over a process/JSON boundary, and
renders human, JSON, and markdown output for local and CI use.

It gives dbt users a Python CLI while preserving the governance package
architecture:

```text
dbt-governance
  -> host-side dbt lifecycle, config, runtime setup, and rendering
  -> process/JSON boundary
  -> @anarchitects/governance-runtime-dbt
  -> @anarchitects/governance-adapter-dbt
  -> @anarchitects/governance-extension-dbt
  -> @anarchitects/governance-core
```

## Purpose

The host owns:

- dbt-native CLI UX
- `governance.yml` loading, validation, and `init`
- dbt project and artifact path hints
- optional `dbt parse`
- pinned Node runtime setup and diagnostics
- process invocation of `dbt-governance-runtime`
- human, JSON, and markdown output
- report writing
- final CLI and CI exit codes

The host does not own:

- governance semantics
- dbt artifact loading or validation
- dbt artifact normalization
- dbt-specific rules, scoring, signals, or recommendations
- TypeScript runtime composition

## Package Identity

- Nx project: `governance-host-dbt`
- Python distribution: `anarchitecture-dbt-governance`
- Python module: `anarchitecture_dbt_governance`
- CLI command: `dbt-governance`
- Runtime package: `@anarchitects/governance-runtime-dbt`
- Pinned runtime version: `0.1.0`
- Runtime executable: `dbt-governance-runtime`
- Runtime version source:
  [`runtime_manifest.json`](./src/anarchitecture_dbt_governance/runtime_manifest.json)
- Pinned Node range: `>=20 <25`
- Contract version: `1.0.0`

## Architecture And Boundaries

### Ownership

#### governance-host-dbt

- CLI UX
- config loading and precedence
- dbt project and artifact path hints
- optional `dbt parse`
- pinned runtime setup and `doctor`
- process/JSON invocation
- human, JSON, and markdown rendering
- report file output
- CI exit code mapping

#### governance-runtime-dbt

- TypeScript composition boundary
- JSON in / JSON out runtime execution
- composition of Core, adapter, and extension

#### governance-adapter-dbt

- authoritative dbt project detection at the adapter boundary
- artifact loading
- artifact validation
- artifact normalization
- dbt metadata preservation

#### governance-extension-dbt

- dbt-specific interpretation
- dbt-specific diagnostics
- dbt-specific signals, metrics, and recommendations

#### governance-core

- canonical governance contracts
- deterministic governance assessment behavior

### Host Boundary Rules

The host must not:

- import `@anarchitects/governance-core`
- import `@anarchitects/governance-adapter-dbt`
- import `@anarchitects/governance-extension-dbt`
- import `@anarchitects/governance-runtime-dbt` TypeScript source
- load or parse dbt artifacts semantically
- validate dbt artifact structure semantically
- normalize dbt artifacts
- implement dbt-specific governance rules, metrics, diagnostics,
  recommendations, or scoring

Authoritative architectural guidance lives in
[ADR 0003](../../../docs/adr/0003-governance-core-adapter-extension-host-boundaries.md)
and the
[Governance Boundary Contributor Guide](../../../docs/governance-boundary-contributor-guide.md).

## Install And Local Development

Run the host through the existing Nx and `@nxlv/python` targets:

```bash
yarn nx run governance-host-dbt:lint
yarn nx run governance-host-dbt:test
yarn nx run governance-host-dbt:e2e
yarn nx run governance-host-dbt:build
```

Exercise the CLI from the package directory with `uv`:

```bash
cd packages/governance/host-dbt
uv run python -m anarchitecture_dbt_governance.cli --help
uv run dbt-governance --help
```

## Using `dbt-governance` In An Existing dbt Project

This package is installed as a Python CLI. It is not installed through
`packages.yml` or `dbt deps`.

Install it with one of these approaches:

```bash
pipx install anarchitecture-dbt-governance
```

```bash
uv tool install anarchitecture-dbt-governance
```

```bash
pip install anarchitecture-dbt-governance
```

Run it from the root of the dbt project, or pass `--project-dir`:

```bash
cd my-dbt-project
dbt-governance init
dbt-governance setup
dbt parse
dbt-governance check
```

If you want the host to generate `manifest.json` when it is missing:

```bash
dbt-governance check --parse
```

## CLI Commands

### `dbt-governance init`

Creates a starter `governance.yml`.

Options:

- `--project-dir`
- `--config`
- `--force`

Behavior:

- writes a starter config file
- refuses to overwrite an existing config by default
- overwrites only when `--force` is set

### `dbt-governance setup`

Verifies the host runtime requirements and installs or verifies the pinned
runtime package in the controlled cache.

Options:

- `--config`

### `dbt-governance doctor`

Reports host, config, Node, package-manager, runtime-manifest, and installed
runtime status.

Options:

- `--config`

### `dbt-governance check`

Runs the host lifecycle, invokes the runtime, renders a result, and returns a
final process exit code.

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

### `dbt-governance report`

Runs the same host lifecycle as `check`, then renders the preserved runtime
result in a selected report format.

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

## `governance.yml`

### File Name And Precedence

- default file name: `governance.yml`
- `dbt-governance init` creates it
- `dbt-governance init --force` overwrites an existing file
- precedence is:
  CLI flags > `governance.yml` > host defaults

### Section Boundaries

- `profile`: canonical governance profile routing
- `adapter`: dbt adapter path hints and adapter-owned options
- `extension`: dbt extension-owned options
- `runtime`: runtime cache and report defaults
- `host`: host artifact lifecycle, output mode, and CI behavior

### Minimal Example

```yaml
profile:
  path: governance.profile.yml
  document:
    name: dbt

adapter:
  paths:
    projectDir: .
    manifestPath: target/manifest.json
    catalogPath: target/catalog.json
    runResultsPath: target/run_results.json
    sourcesPath: target/sources.json
  options:
    validationMode: strict

extension:
  options:
    signals: {}
    metrics: {}

runtime:
  cacheDir: .anarchitecture/dbt-governance/runtime
  reportPath: target/governance-report.json

host:
  artifactMode: use-existing-or-parse
  output: human
  ci:
    failOnBlockingViolations: true
```

### Supported Artifact Modes

- `require-existing`
- `use-existing-only`
- `use-existing-or-parse`

Artifact mode behavior:

- `require-existing`: require a resolved `manifest.json`; do not fall back to
  `dbt parse` unless the user explicitly passes `--parse`
- `use-existing-only`: prefer existing artifacts and never invoke `dbt parse`
- `use-existing-or-parse`: use existing artifacts when present, otherwise run
  `dbt parse`

### Supported Output Modes

- `human`
- `json`

Output mode behavior:

- `human`: render human-readable CLI summaries
- `json`: emit machine-readable JSON for `check` by default

### `failOnBlockingViolations`

`host.ci.failOnBlockingViolations` controls how successful checks with blocking
violations map to the final exit code.

- `true`: blocking violations return exit code `1`
- `false`: blocking violations are still rendered and written to reports, but
  the check returns exit code `0`

## Artifact Lifecycle

The host owns operational artifact lifecycle decisions only.

- existing `target/manifest.json` is preferred
- `--use-existing-artifacts` never invokes `dbt parse`
- `--parse` invokes `dbt parse` only when `manifest.json` is missing
- `catalog.json`, `run_results.json`, and `sources.json` are optional path
  hints
- the host checks artifact availability and readability only
- the adapter and runtime perform authoritative loading, validation, and
  normalization after handoff

## Runtime Setup

`setup` and `doctor` operate on the pinned runtime defined by
[`runtime_manifest.json`](./src/anarchitecture_dbt_governance/runtime_manifest.json).

The host:

- verifies Node.js
- verifies a supported package manager
- uses the pinned runtime package and version from the manifest
- pins `@anarchitects/governance-runtime-dbt@0.1.0`
- requires contract version `1.0.0`
- requires Node.js `>=20 <25`
- installs into a controlled cache
- never installs globally
- never installs `latest`
- does not mutate the dbt project `package.json`
- does not mutate the repository `package.json`

Default cache layout:

```text
~/.cache/anarchitecture/dbt-governance/runtimes/@anarchitects/governance-runtime-dbt/<version>/
```

`doctor` reports:

- host version
- config path and load status
- runtime manifest values
- Node.js availability and compatibility
- package-manager availability
- runtime cache path
- installed runtime package name and version
- runtime executable availability
- overall runtime compatibility status

## Runtime Handoff

The host invokes the runtime over a stable process boundary.

- the host writes JSON to `dbt-governance-runtime` over `stdin`
- the runtime writes JSON to `stdout`
- `stderr` is preserved as diagnostic context
- non-zero runtime process exits preserve structured `stdout` JSON when it is
  valid
- invalid runtime JSON remains a host invocation failure
- the host never imports runtime TypeScript internals

## Output And Reports

### `check`

- default output is human-readable summary output
- `--json` emits machine-readable JSON only on `stdout`
- `--report-path` writes the JSON report envelope to disk

### `report`

- `--format json` emits the JSON report envelope
- `--format markdown` emits a markdown report
- `--report-path` writes the selected report format to disk

## Exit Codes

- `0`: successful check with no blocking violations, or blocking violations
  allowed by `host.ci.failOnBlockingViolations=false`
- `1`: successful check with blocking violations when
  `host.ci.failOnBlockingViolations=true`
- `2`: host, dbt, or runtime setup or invocation failure
- `3`: unsupported or incompatible runtime or contract

## E2E Test Strategy

The host e2e suite validates dbt-native host lifecycle and the process/JSON
boundary using fake executables. It does not constitute a full real-runtime
integration test.

Current e2e coverage:

- uses fake `dbt`, `node`, `npm`, and `dbt-governance-runtime` executables
- validates host lifecycle, rendering, report writing, and exit codes
- validates the process/JSON boundary hermetically
- uses no warehouse
- uses no secrets
- uses no dbt Cloud
- uses no network for the main e2e suite

Fixture notes live in
[tests/fixtures/e2e/README.md](./tests/fixtures/e2e/README.md).

## Troubleshooting

Common host diagnostics include:

- missing `dbt_project.yml`
- missing `manifest.json`
- `dbt` executable not found
- `dbt parse` failed
- missing Node.js
- unsupported Node.js version
- missing package manager
- runtime package missing from the controlled cache
- runtime package name or version mismatch
- runtime executable missing
- invalid runtime JSON output
- incompatible runtime metadata
- invalid `governance.yml`

## Related Docs

- [dbt Governance Host](../../../docs/governance/dbt-governance-host.md)
- [ADR 0003](../../../docs/adr/0003-governance-core-adapter-extension-host-boundaries.md)
- [Governance Boundary Contributor Guide](../../../docs/governance-boundary-contributor-guide.md)
- [Target Canonical Governance Model](../../../docs/governance/target-canonical-governance-model.md)

## Preview Release Checklist

Runtime prerequisite:

- `@anarchitects/governance-runtime-dbt@0.1.0` must be published before
  releasing the Python host, because `dbt-governance setup` installs the
  pinned runtime version.

Validation:

```bash
yarn nx run governance-host-dbt:lint
yarn nx run governance-host-dbt:test
yarn nx run governance-host-dbt:e2e
yarn nx run governance-host-dbt:build
```

Publish:

```bash
yarn nx run governance-host-dbt:nx-release-publish
```
