# @anarchitects/governance-cli

## Overview

`@anarchitects/governance-cli` provides the `agov` command-line interface and a
standalone Governance host API. It loads workspace data, runs Governance
assessment commands, validates inputs, renders command output, and returns
process-friendly exit codes for local and CI usage.

Use this package when you want to run Governance from a shell, CI job, or
automation script without writing a custom host.

Package boundaries follow
[ADR 0001](../../../docs/adr/0001-governance-package-boundaries.md) and
[ADR 0003](../../../docs/adr/0003-governance-core-adapter-extension-host-boundaries.md).
Practical contributor guidance lives in
[`docs/governance-boundary-contributor-guide.md`](../../../docs/governance-boundary-contributor-guide.md).

## Key Concepts

- `agov assess` runs a Governance assessment and renders assessment artifacts.
- `agov check` runs a Governance gate suitable for CI.
- Inspection commands render focused slices such as metrics, violations,
  recommendations, signals, dependency relations, and workspace inventory.
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

```bash
npx agov assess --workspace ./governance.workspace.json --profile ./governance.profile.json
npx agov check --workspace ./governance.workspace.json --profile ./governance.profile.json
npx agov assess --adapter @anarchitects/governance-adapter-typescript --root . --profile ./governance.profile.json
```

Manual workspace documents use canonical `nodes` and `relations`:

```json
{
  "id": "workspace",
  "name": "workspace",
  "root": ".",
  "nodes": [
    {
      "id": "package:api",
      "name": "api",
      "kind": "service",
      "technology": "typescript",
      "sourceSystem": "pnpm",
      "root": "packages/api",
      "path": "packages/api",
      "tags": [],
      "metadata": {}
    }
  ],
  "relations": [
    {
      "id": "ts:dependency:package:api->package:shared",
      "sourceNodeId": "package:api",
      "targetNodeId": "package:shared",
      "kind": "dependency",
      "metadata": {}
    }
  ]
}
```

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

```ts
import {
  runAgovCheck,
  type AgovCheckOptions,
  type AgovCheckResult,
} from '@anarchitects/governance-cli';
```

## Usage

### Assessment And Gate Commands

```bash
agov assess --workspace ./governance.workspace.json --profile ./governance.profile.json
agov check --workspace ./governance.workspace.json --profile ./governance.profile.json
agov assess --workspace ./governance.workspace.json --profile ./governance.profile.json --include-top-signals
```

`Top Issues` stays focused on actionable `warning` and `error` findings. Use
`agov assess --include-top-signals` when you want a separate `Top Signals`
section that can include `info`-level telemetry for architecture inspection or
debugging.

### Host Configuration Layering

The standalone CLI host keeps canonical policy separate from adapter-specific
and extension-specific runtime config.

Use the canonical Governance profile for Core-owned policy only:

- profile rules and policy
- canonical ownership requirements
- canonical domain, layer, and scope expectations

Do not put adapter extraction options or extension interpretation options into
the canonical profile.

Use `agov.config.json` or `governance.config.json` for host-owned layering:

```json
{
  "profile": "./governance.profile.json",
  "adapter": "@anarchitects/governance-adapter-typescript",
  "extensions": ["@anarchitects/governance-extension-typescript"],
  "adapterOptions": {
    "@anarchitects/governance-adapter-typescript": {
      "discoveryConfig": {
        "projects": [
          { "pattern": "libs/*", "projection": { "type": "library" } }
        ]
      }
    }
  },
  "extensionOptions": {
    "@anarchitects/governance-extension-typescript": {
      "signals": {
        "createdAt": "2026-06-12T00:00:00.000Z"
      }
    }
  }
}
```

In that layering:

- `profile` remains canonical Core policy
- `adapterOptions` routes only to adapter creation/loading
- `extensionOptions` routes only to extension creation/registration/runtime
- Core evaluation receives the resolved canonical profile and normalized
  workspace data, not the host config blobs directly

Current precedence rules:

- explicit CLI flags override host config for `profile`, `adapter`, `workspace`,
  `root`, and `format`
- host config provides `extensions`, `adapterOptions`, and `extensionOptions`
- explicit configured extensions are loaded first, then an inferred matching
  extension may be added for adapter flows if it is available and not already
  configured

TypeScript example:

- TypeScript discovery config belongs in `adapterOptions` for
  `@anarchitects/governance-adapter-typescript`
- TypeScript extension interpretation config belongs in `extensionOptions` for
  `@anarchitects/governance-extension-typescript`
- canonical policy still belongs in `governance.profile.json`

dbt-oriented note:

- future dbt hosts should apply the same ownership layering between canonical profile,
  dbt adapter config, dbt extension config, and dbt runtime/host options
- dbt-specific extraction and interpretation options should not be folded into
  the canonical profile

dbt example:

```json
{
  "profile": "./governance.profile.json",
  "adapter": "@anarchitects/governance-adapter-dbt",
  "extensions": ["@anarchitects/governance-extension-dbt"],
  "adapterOptions": {
    "@anarchitects/governance-adapter-dbt": {
      "paths": {
        "projectDir": "./analytics",
        "manifestPath": "./analytics/target/manifest.json"
      },
      "validationMode": "strict"
    }
  },
  "extensionOptions": {
    "@anarchitects/governance-extension-dbt": {
      "signals": {},
      "metrics": {}
    }
  }
}
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

## Compatibility

The CLI accepts canonical graph data through `nodes` and `relations`. The
`dependencies` command remains user-facing terminology for dependency-kind
relations, but the underlying workspace contract stays canonical.

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

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository [LICENSE](../../../LICENSE) and [NOTICE](../../../NOTICE) files.
