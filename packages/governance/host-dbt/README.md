# anarchitecture-dbt-governance

`anarchitecture-dbt-governance` is the scaffold for a future dbt-native
Governance host. The current implementation resolves a dbt project, manages the
artifact lifecycle for `check`, and stops before runtime composition or
artifact normalization.

The Nx project is registered as `governance-host-dbt` and follows the workspace
`@nxlv/python` setup with `uv` configured in [`nx.json`](../../../nx.json).

## CLI

The package exposes `dbt-governance` with these commands:

- `check`
- `setup`
- `doctor`
- `init`
- `report`

`governance.yml` is the host-local config file for dbt-native UX, adapter path
hint routing, runtime setup defaults, and report/output behavior. It does not
replace the canonical Governance profile, adapter semantics, extension
semantics, or runtime composition ownership.

Config precedence is:

- CLI flags
- `governance.yml`
- host defaults

`check` supports:

- `--project-dir`
- `--profiles-dir`
- `--target`
- `--target-path`
- `--config`
- `--use-existing-artifacts`
- `--parse`
- `--json`
- `--report-path`

`setup` and `doctor` support:

- `--config`

`init` supports:

- `--project-dir`
- `--config`
- `--force`

`report` supports:

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

Config loading:

- `--config path/to/governance.yml` loads an explicit config file
- without `--config`, the host loads `governance.yml` from the resolved
  project directory or current directory when present
- when no config file exists, the host falls back to built-in defaults

Minimal config example:

```yaml
profile:
  path: governance.profile.yml
  document:
    name: dbt

adapter:
  paths:
    projectDir: .
    manifestPath: target/manifest.json
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

Artifact lookup behavior:

- `--project-dir` overrides the current working directory.
- `dbt_project.yml` must exist in the resolved project directory.
- `manifest.json` is resolved from `--target-path` when provided, otherwise
  from `target/manifest.json`.
- Existing `manifest.json` is always preferred and used without invoking dbt.
- Optional `catalog.json`, `run_results.json`, and `sources.json` are detected
  and carried forward when present.
- After path hints are resolved, `check` invokes
  `@anarchitects/governance-runtime-dbt` through the `dbt-governance-runtime`
  process/JSON boundary.
- Runtime `stdout` remains machine-readable JSON from the runtime boundary.
- The host preserves the runtime JSON result and does not inspect
  adapter/extension internals beyond runtime package metadata validation.
- Adapter, extension, runtime, and host config sections stay separate and are
  routed to their owning layer instead of being collapsed into one profile.

Output modes:

- `dbt-governance check` renders a concise human summary for local use.
- `dbt-governance check --json` writes machine-readable JSON only to stdout.
- `dbt-governance check --report-path target/governance-report.json` writes the
  JSON report envelope to disk and reports the path in human mode.
- `dbt-governance report --format json` emits the JSON report envelope.
- `dbt-governance report --format markdown` emits a minimal markdown report.
- `dbt-governance report --report-path ...` writes the selected report format
  to disk.

`--parse` behavior:

- if `manifest.json` is missing and `--parse` is set, the host invokes
  `dbt parse`
- if `manifest.json` is missing and `--parse` is not set, the host returns a
  clear diagnostic and fails

`--use-existing-artifacts` behavior:

- when this flag is set, the host never invokes dbt
- if `manifest.json` is missing, the command fails with a clear host
  diagnostic instead of falling back to `dbt parse`

`setup` behavior:

- may load `runtime.cacheDir` from `governance.yml`
- validates `runtime_manifest.json`
- requires Node.js in the pinned range `>=20 <25`
- resolves npm first, with the repo package manager as a fallback
- installs or verifies the exact pinned
  `@anarchitects/governance-runtime-dbt` version in a controlled cache
- never installs globally
- never installs `latest`

`doctor` behavior:

- reports config path/status
- reports the host version
- reports the runtime manifest values
- reports Node.js and package-manager availability
- reports the controlled runtime cache location
- reports runtime package resolution, version, and executable availability
- reports overall runtime compatibility status

Default runtime cache location:

- `~/.cache/anarchitecture/dbt-governance/runtimes/@anarchitects/governance-runtime-dbt/<version>/`

`init` behavior:

- creates a starter `governance.yml`
- refuses to overwrite an existing config by default
- `--force` overwrites the existing file
- does not generate dbt artifacts
- does not run runtime setup
- does not mutate `dbt_project.yml`, `package.json`, or `pyproject.toml`

Boundary:

- the host manages dbt-native artifact lifecycle orchestration
- the host manages pinned runtime setup and validation
- the host constructs JSON input and invokes the runtime process boundary
- the host renders human, JSON, and markdown outputs from the preserved runtime
  result
- the host maps final process exit codes for CLI and CI consumers
- the host loads `governance.yml`, validates it, and routes each config section
  to the correct ownership layer
- the host only performs lightweight path existence and readability checks
- the host does not normalize dbt artifacts
- the host does not compute governance results
- the host does not compose governance-core, adapter, or extension packages
- runtime-dbt remains the TypeScript composition boundary
- authoritative dbt artifact loading, validation, and normalization begin after
  the runtime handoff

Exit codes:

- `0`: successful check with no blocking violations
- `1`: successful check with blocking governance violations
- `2`: host, dbt, or runtime setup/invocation failure
- `3`: unsupported or incompatible runtime or contract metadata

## Boundary Rules

This scaffold must not:

- depend on `@anarchitects/governance-core`
- depend on `@anarchitects/governance-adapter-dbt`
- depend on `@anarchitects/governance-extension-dbt`
- implement dbt artifact normalization
- implement governance evaluation
- implement runtime composition
- semantically parse manifest content in Python

Package boundaries follow
[ADR 0001](../../../docs/adr/0001-governance-package-boundaries.md) and
[ADR 0003](../../../docs/adr/0003-governance-core-adapter-extension-host-boundaries.md).
Practical contributor guidance lives in
[`docs/governance-boundary-contributor-guide.md`](../../../docs/governance-boundary-contributor-guide.md).

## Local Development

```bash
yarn nx run governance-host-dbt:lint
yarn nx run governance-host-dbt:test
yarn nx run governance-host-dbt:e2e
yarn nx run governance-host-dbt:build
```

E2E coverage:

- `governance-host-dbt:e2e` runs subprocess CLI tests against small copied
  fixtures instead of mutating checked-in artifacts
- existing dbt artifact fixtures are reused from `governance-adapter-dbt` where
  possible
- the suite is hermetic by default: fake `node`, `npm`, `dbt`, and
  `dbt-governance-runtime` executables cover runtime setup, parse mode, and the
  process/JSON boundary without network access
- the current e2e target is intentionally fake-runtime-only coverage for host
  behavior; it does not claim to be a real `governance-runtime-dbt` smoke test
- the assertions focus on the host/runtime boundary: path hints go over
  stdin/stdout JSON, JSON mode stays machine-readable, and host-side rendering
  and exit codes remain deterministic

If `uv` is installed locally, the CLI entrypoint can be exercised with:

```bash
cd packages/governance/host-dbt
uv run dbt-governance --help
uv run dbt-governance init
uv run dbt-governance check --project-dir ./path/to/dbt/project
uv run dbt-governance check --project-dir ./path/to/dbt/project --parse
uv run dbt-governance check --config ./governance.yml
uv run dbt-governance doctor --config ./governance.yml
```
