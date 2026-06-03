# @anarchitects/governance-cli

## Overview

`@anarchitects/governance-cli` provides the `agov` command-line interface and a
standalone Governance host API. It loads workspace data, runs Governance
assessment commands, validates inputs, renders command output, and returns
process-friendly exit codes for local and CI usage.

Use this package when you want to run Governance from a shell, CI job, or
automation script without writing a custom host.

## Key Concepts

- `agov assess` runs a Governance assessment and renders assessment artifacts.
- `agov check` runs a Governance gate suitable for CI.
- Inspection commands render focused slices such as metrics, violations,
  recommendations, signals, dependencies, and workspace inventory.
- Validation commands check profile and workspace documents.
- Adapter mode loads a concrete Governance adapter package by name.
- Workspace document mode reads an existing workspace or adapter-result
  document from disk.

## Installation

```bash
npm install --save-dev @anarchitects/governance-cli
```

After installation, the package exposes the `agov` executable.

## Quick Start

Run an assessment from explicit workspace and profile files:

```bash
npx agov assess --workspace ./governance.workspace.json --profile ./governance.profile.json
```

Run a CI gate:

```bash
npx agov check --workspace ./governance.workspace.json --profile ./governance.profile.json
```

Run with an installed adapter package:

```bash
npx agov assess --adapter @anarchitects/governance-adapter-typescript --root . --profile ./governance.profile.json
```

## Architecture

```text
agov command
  -> CLI option and config resolution
  -> Workspace document or adapter loading
  -> Governance Core normalization and assessment
  -> Optional extension registration
  -> Command-specific output and exit code
```

The CLI is adapter-agnostic. Concrete adapter and extension packages are loaded
by the host when requested or configured.

## Responsibilities

This package owns:

- the `agov` executable
- command parsing and option resolution
- config-file discovery for CLI execution
- workspace document loading and adapter loading
- extension loading and registration orchestration
- command output formatting for supported CLI formats
- process exit-code behavior for governance gates and runtime failures

This package does not own:

- canonical Governance contracts or assessment semantics
- TypeScript workspace discovery or other adapter extraction logic
- technology-specific rules, metrics, or recommendations
- report data contracts owned by Core
- adapter package APIs
- extension package APIs beyond loading and registration

## Public API

The package publishes the `agov` binary and a root TypeScript entrypoint.

Programmatic command APIs include:

- `runAgovAssess(...)`
- `runAgovCheck(...)`
- `runAgovInspect(...)`
- `runAgovMetrics(...)`
- `runAgovViolations(...)`
- `runAgovRecommendations(...)`
- `runAgovSignals(...)`
- `runAgovDependencies(...)`
- `runAgovProfileValidate(...)`
- `runAgovWorkspaceValidate(...)`
- `runAgovCli(...)`

The root entrypoint also exports command option/result types, parser helpers,
runtime option resolution helpers, exit-code constants, and CLI runtime error
types.

Import programmatic APIs from the package root:

```ts
import {
  runAgovCheck,
  type AgovCheckResult,
} from '@anarchitects/governance-cli';
```

## Usage

### Assessment And Gate Commands

```bash
agov assess --workspace ./governance.workspace.json --profile ./governance.profile.json
agov check --workspace ./governance.workspace.json --profile ./governance.profile.json
```

### Inspection Commands

```bash
agov inspect --workspace ./governance.workspace.json --format table
agov metrics --workspace ./governance.workspace.json --profile ./governance.profile.json --format json
agov violations --workspace ./governance.workspace.json --profile ./governance.profile.json --severity error
agov recommendations --workspace ./governance.workspace.json --profile ./governance.profile.json --priority high
agov signals --workspace ./governance.workspace.json --profile ./governance.profile.json --source rule
agov dependencies --workspace ./governance.workspace.json --format json
```

### Validation Commands

```bash
agov profile validate --profile ./governance.profile.json --format table
agov workspace validate --workspace ./governance.workspace.json --format markdown
```

## Configuration

Commands can receive input through explicit CLI flags, a config file, or
conventional workspace/profile file discovery.

Common options include:

- `--config <path>`
- `--profile <path>`
- `--workspace <path>`
- `--adapter <package>`
- `--root <path>`
- `--format <text|table|markdown|json>`
- `--output <path>`

Supported output formats are:

- `text`
- `table`
- `markdown`
- `json`

Use `json` for automation and the other formats for human-readable output.

## Extension Points

The CLI can load adapter packages and register extension packages through
Core-owned contracts. Adapter packages provide workspace facts. Extension
packages provide optional technology-specific interpretation. The CLI composes
them at runtime but does not own their semantics.

## Related Packages

- `@anarchitects/governance-core` owns canonical contracts, diagnostics,
  normalization, and deterministic assessment helpers.
- `@anarchitects/governance-adapter-typescript` is a concrete adapter for
  TypeScript-oriented workspaces.
- `@anarchitects/governance-extension-typescript` is the TypeScript extension
  package.

## Compatibility

The CLI accepts canonical graph data through `nodes` and `relations` and also
supports project/dependency compatibility fields where adapters provide them.
Focused report commands can apply filters to human-readable output without
changing assessment or gate semantics.

## FAQ

### Does the CLI include a TypeScript adapter?

No. Install the adapter package separately and pass it with `--adapter`, or use
a workspace document.

### Should libraries import CLI internals?

No. Programmatic consumers should import from `@anarchitects/governance-cli` or
use `@anarchitects/governance-core` directly.

### Does `agov check` differ from `agov assess`?

Yes. `agov check` is intended for governance gate behavior and CI exit codes.
`agov assess` is intended for assessment output.

## License

MIT
