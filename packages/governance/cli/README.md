# `@anarchitects/governance-cli`

Standalone Governance CLI and runtime host for running Governance commands across repository and CI environments.

## Overview

`@anarchitects/governance-cli` publishes the `agov` executable and host APIs for:

- Governance assessment and gate commands
- inventory and inspection commands over normalized Governance artifacts
- input validation commands for profiles and workspaces

The package depends on `@anarchitects/governance-core` and is adapter-agnostic.
Concrete adapters are installed separately by consumers and loaded dynamically by package name at runtime.

For package boundary rules and dependency direction, see [ADR 0001: Governance Package Boundaries for Core, CLI, Adapters, and Extensions](../../../docs/adr/0001-governance-package-boundaries.md).

## Command Categories

Assessment and gate commands:

- `agov assess`
- `agov check`

Inventory and inspection commands:

- `agov inspect`
- `agov metrics`
- `agov violations`
- `agov recommendations`
- `agov signals`
- `agov dependencies`

Validation commands:

- `agov profile validate`
- `agov workspace validate`

Utility commands:

- `agov --help`
- `agov --version`

## Command Semantics

- `assess` is the primary assessment orchestration command.
- `check` is the governance gate command and is suitable for CI exit-code gating.
- `inspect`, `metrics`, `violations`, `recommendations`, `signals`, and `dependencies` provide inventory/inspection slices and are not gates.
- `profile validate` and `workspace validate` validate inputs and do not imply full assessment/gating semantics.

## Runtime Modes

Commands that operate on workspace data support these input modes:

- canonical workspace document mode via `--workspace <path>`
- explicit adapter mode via `--adapter <package> --root <path>`
- adapter discovery mode via configured/discovered adapter candidates and probe-based selection
- config discovery via `agov.config.json` or `governance.config.json`
- conventional file discovery when explicit/config values are absent

Resolution precedence is:

- explicit CLI flags
- config file values
- conventional file discovery
- adapter candidate discovery and probe selection

## Output Formats

Supported output formats:

- `--format text`
- `--format table`
- `--format markdown`
- `--format json`

Output destination:

- `--output <path>` where supported by the command

Output intent:

- `json` is intended for automation and scripting.
- `text`, `table`, and `markdown` are intended for humans and documentation.

## Common Options

Commonly used options across command groups:

- `--config <path>`
- `--profile <path>`
- `--workspace <path>`
- `--adapter <package>`
- `--root <path>`
- `--format <text|table|markdown|json>`
- `--output <path>`

Command-specific filters:

- `agov inspect`: `--project`, `--domain`, `--layer`, `--type`
- `agov metrics`: `--family`, `--metric`, `--weakest`
- `agov violations`: `--severity`, `--rule`, `--category`, `--project`, `--source-plugin`
- `agov recommendations`: `--priority`
- `agov signals`: `--source`, `--type`, `--severity`
- `agov dependencies`: `--source`, `--target`, `--project`, `--type`

For command-specific help:

- `agov assess --help`
- `agov check --help`
- `agov inspect --help`
- `agov metrics --help`
- `agov violations --help`
- `agov recommendations --help`
- `agov signals --help`
- `agov dependencies --help`
- `agov profile validate --help`
- `agov workspace validate --help`

## Examples

Run an assessment from explicit workspace/profile documents:

```bash
agov assess --workspace ./governance.workspace.json --profile ./governance.profile.json
```

Run a CI gate:

```bash
agov check --workspace ./governance.workspace.json --profile ./governance.profile.json
```

Inspect normalized workspace inventory:

```bash
agov inspect --workspace ./governance.workspace.json --format table
```

Emit metrics as JSON for automation:

```bash
agov metrics --workspace ./governance.workspace.json --profile ./governance.profile.json --format json
```

Filter violations by severity:

```bash
agov violations --workspace ./governance.workspace.json --profile ./governance.profile.json --severity error
```

Filter recommendations by priority:

```bash
agov recommendations --workspace ./governance.workspace.json --profile ./governance.profile.json --priority high
```

List dependency data:

```bash
agov dependencies --workspace ./governance.workspace.json --format json
```

Validate a profile:

```bash
agov profile validate --profile ./governance.profile.json --format table
```

Validate a workspace:

```bash
agov workspace validate --workspace ./governance.workspace.json --format markdown
```

Use explicit adapter mode (adapter package installed by consumer):

```bash
agov assess --adapter @your-org/governance-adapter --root . --profile ./governance.profile.json
```

Use config discovery:

```bash
agov check --config ./agov.config.json
```

## Adapter and Boundary Notes

- The CLI depends on Governance Core.
- The CLI is adapter-agnostic.
- Concrete adapters are installed separately by consumers.
- Adapter packages are dynamically loaded by name at runtime.
- Future adapters should not require CLI dependency changes.
- Detailed boundary rules are defined in ADR 0001.

This README intentionally focuses on CLI behavior and avoids duplicating canonical Core model semantics.

## Related Packages

- `@anarchitects/governance-core` owns canonical Governance contracts and deterministic evaluation logic.
- Concrete `@anarchitects/governance-adapter-*` packages implement Core-owned adapter contracts.
