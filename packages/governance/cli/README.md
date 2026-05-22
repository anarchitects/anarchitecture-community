# `@anarchitects/governance-cli`

Standalone Governance CLI and runtime host for running Governance checks outside Nx.
Standalone Governance CLI and host/runtime APIs for running Governance checks outside Nx.
Standalone Governance CLI and runtime host for running Governance checks outside Nx.

## Overview

`@anarchitects/governance-cli` provides the executable `agov` command and the programmatic host/runtime APIs for Community-owned Governance packages.

It orchestrates Governance checks through `@anarchitects/governance-core`, supports canonical workspace input documents, and can load compatible adapters dynamically without taking a static dependency on concrete adapter packages.
`@anarchitects/governance-cli` provides the standalone host surface for Community-owned Governance packages. It supports both the packaged `agov` executable and the exported runtime APIs for programmatic hosts.
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
- loading explicit standalone Governance profile documents
- loading explicit manual Governance workspace documents
- resolving CLI options from flags, config files, and conventions
- loading compatible Governance adapters dynamically by package name
- resolving CLI options from flags, config files, and conventions
- loading compatible Governance adapters dynamically by package name
- orchestrating Governance evaluation through `@anarchitects/governance-core`
- returning a structured Governance check result from the public API
- keeping argv parsing, exit handling, and report rendering as host concerns
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

The current standalone host flow supports:

- manual workspace documents in `.json`, `.yaml`, or `.yml`
- standalone profile documents in `.json`
- report rendering formats `table`, `markdown`, and `json`
- `text` as a compatibility alias for `table`
- report rendering formats `table`, `markdown`, and `json`
- `text` as a compatibility alias for `table`

## Adapter Model

The intended consumer model for this package is adapter-agnostic:

- the CLI/runtime host should depend on `@anarchitects/governance-core`
- concrete adapters should implement Core-owned contracts
- concrete adapters should be supplied, registered, injected, or resolved through Core-owned abstractions
- adding a future adapter should not require changing this package’s public contract

That is the model package consumers should follow.

## Binary Packaging

This package publishes an `agov` executable through `package.json#bin`.
`@anarchitects/governance-cli` is adapter-agnostic.

Current command surface:

- `agov --help`
- `agov --version`
- `agov check`
- `agov check --workspace <path> --profile <path>`
- `agov check --adapter <package> --root <path> --profile <path>`

The CLI resolves options in this order:

- explicit flags
- config file
- conventional file discovery or adapter inference
- error with guidance

Supported output formats:

- `table`
- `markdown`
- `json`
- `text` as a compatibility alias for `table`
- the package depends on `@anarchitects/governance-core`, not on concrete adapter packages
- concrete adapters implement Core-owned contracts
- adapters may be injected, discovered, or dynamically loaded by package name
- adding a future adapter must not require changing the CLI package dependency graph

If you want to use a concrete adapter such as `@anarchitects/governance-adapter-typescript`, that adapter must be installed separately in the consuming workspace.

For detailed package-boundary rules and adapter-loading expectations, see
[ADR 0001: Governance Package Boundaries for Core, CLI, Adapters, and Extensions](../../../docs/adr/0001-governance-package-boundaries.md).

## Package Boundaries

`@anarchitects/governance-cli` is a standalone runtime host.
`@anarchitects/governance-cli` is a standalone runtime host.

It should:

- orchestrate Core-owned contracts
- own command behavior, configuration, and output
- remain reusable outside Nx
- orchestrate Core-owned contracts
- own command behavior, configuration, and output
- remain reusable outside Nx

It should not:

- become the home of canonical Governance contracts
- statically import concrete adapter packages
- own adapter-specific detection heuristics
- statically import concrete adapter packages
- own adapter-specific detection heuristics
- take on Nx-only responsibilities

## Related Packages

- `@anarchitects/governance-core` owns canonical Governance contracts and deterministic evaluation logic
- `@anarchitects/governance-adapter-typescript` is a sibling concrete adapter package for TypeScript workspace discovery
- `@anarchitects/governance-core` owns canonical Governance contracts and deterministic evaluation logic
- `@anarchitects/governance-adapter-typescript` is a sibling concrete adapter package for TypeScript workspace discovery
