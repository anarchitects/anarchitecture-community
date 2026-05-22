# `@anarchitects/governance-cli`

Standalone Governance CLI and runtime host for running Governance checks outside Nx.

## Overview

`@anarchitects/governance-cli` provides the executable `agov` command and the programmatic host/runtime APIs for Community-owned Governance packages.

It orchestrates Governance checks through `@anarchitects/governance-core`, supports canonical workspace input documents, and can load compatible adapters dynamically without taking a static dependency on concrete adapter packages.

## Responsibilities

This package is responsible for:

- exposing the `agov` executable command surface
- parsing CLI arguments
- resolving config, profile, workspace, adapter, root, and format options
- loading standalone profile and canonical workspace documents
- dynamically loading compatible Governance adapters by package name
- mapping runtime outcomes to stable exit codes
- rendering table, markdown, text, and JSON output

This package is not responsible for:

- canonical Governance contracts
- concrete adapter implementations
- TypeScript-specific adapter detection heuristics
- Nx graph loading
- Nx plugin runtime behavior
- Nx executors or generators

## Public API

The public package surface is intentionally small:

```ts
import {
  runAgovCheck,
  type AgovCheckOptions,
  type AgovCheckResult,
  type AgovCheckWithAdapterOptions,
  type AgovCheckWithWorkspacePathOptions,
} from '@anarchitects/governance-cli';
```

The root export currently includes:

- `runAgovCheck(...)`
- `AgovCheckOptions`
- `AgovCheckResult`
- `AgovCheckWithAdapterOptions`
- `AgovCheckWithWorkspacePathOptions`

The executable host implementation and argv handling remain internal package modules.

## Executable Usage

This package publishes an `agov` executable through `package.json#bin`.

Current command surface:

- `agov --help`
- `agov --version`
- `agov check`
- `agov check --workspace <path> --profile <path>`
- `agov check --adapter <package> --root <path> --profile <path>`

The CLI resolves values in this order:

- explicit flags
- config file
- conventional file discovery
- adapter discovery and probing
- error with guidance

## Runtime Modes

The standalone host currently supports:

- canonical workspace documents in `.json`, `.yaml`, or `.yml`
- standalone profile documents in `.json`
- explicit adapter mode through `--adapter <package> --root <path>`
- output formats `table`, `markdown`, and `json`
- `text` as a compatibility alias for `table`

Example programmatic usage:

```ts
import { runAgovCheck } from '@anarchitects/governance-cli';

const result = runAgovCheck({
  workspacePath: './governance.workspace.json',
  profilePath: './governance.profile.json',
});

console.log(result.success);
console.log(result.assessment.health.status);
```

## Adapter Model

`@anarchitects/governance-cli` is adapter-agnostic.

That means:

- the package depends on `@anarchitects/governance-core`, not on concrete adapter packages
- concrete adapters implement Core-owned contracts
- adapters may be injected, discovered, or dynamically loaded by package name
- adding a future adapter must not require changing the CLI package dependency graph

If you want to use a concrete adapter such as `@anarchitects/governance-adapter-typescript`, that adapter must be installed separately in the consuming workspace.

For detailed package-boundary rules and adapter-loading expectations, see
[ADR 0001: Governance Package Boundaries for Core, CLI, Adapters, and Extensions](../../../docs/adr/0001-governance-package-boundaries.md).

## Package Boundaries

`@anarchitects/governance-cli` is a standalone runtime host.

It should:

- orchestrate Core-owned contracts
- own command behavior, configuration, and output
- remain reusable outside Nx

It should not:

- become the home of canonical Governance contracts
- statically import concrete adapter packages
- own adapter-specific detection heuristics
- take on Nx-only responsibilities

## Related Packages

- `@anarchitects/governance-core` owns canonical Governance contracts and deterministic evaluation logic
- `@anarchitects/governance-adapter-typescript` is a sibling concrete adapter package for TypeScript workspace discovery
