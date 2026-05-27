# `@anarchitects/governance-cli`

Standalone Governance CLI and runtime host for running Governance checks outside Nx.

## Overview

`@anarchitects/governance-cli` provides the packaged `agov` executable and the programmatic host APIs for running Governance checks against canonical workspace documents or dynamically loaded adapters.

The package depends on `@anarchitects/governance-core` and stays adapter-agnostic. Concrete adapters are loaded by package name and validated against Core-owned contracts at runtime.

## Responsibilities

This package is responsible for:

- exposing the `agov` command surface
- parsing arguments and resolving option precedence
- loading config, profile, and canonical workspace inputs
- discovering generic adapter candidates from config or package metadata
- dynamically loading adapter packages and selecting them through Core-owned probe contracts
- rendering table, markdown, text, and JSON output
- mapping runtime outcomes to stable exit codes

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
  AGOV_EXIT_CONFIGURATION_FAILURE,
  AGOV_EXIT_GOVERNANCE_FAILURE,
  AGOV_EXIT_RUNTIME_FAILURE,
  AGOV_EXIT_SUCCESS,
  loadGenericWorkspace,
  loadStandaloneGovernanceProfile,
  parseAgovCliArgs,
  runAgovCli,
  runAgovAssess,
  runAgovCheck,
  type AgovAssessOptions,
  type AgovAssessResult,
  type AgovCheckOptions,
  type AgovCheckResult,
  type AgovCheckWithAdapterOptions,
  type AgovCheckWithWorkspacePathOptions,
} from '@anarchitects/governance-cli';
```

The root export currently includes:

- `runAgovCheck(...)`
- `runAgovAssess(...)`
- `runAgovCli(...)`
- `parseAgovCliArgs(...)`
- `loadGenericWorkspace(...)`
- `loadStandaloneGovernanceProfile(...)`
- stable CLI exit-code constants
- `AgovCheckOptions`
- `AgovCheckResult`
- `AgovAssessOptions`
- `AgovAssessResult`
- `AgovCheckWithAdapterOptions`
- `AgovCheckWithWorkspacePathOptions`

Parity already covered inside this package includes:

- standalone `agov` command orchestration
- manual YAML/JSON workspace loading and validation
- standalone profile loading and validation
- adapter-agnostic runtime selection and exit-code behavior

That parity is now available as package-root APIs for host tooling and tests
without introducing any Nx dependency.

## Executable Usage

This package publishes an `agov` executable through `package.json#bin`.

Current command surface:

- `agov --help`
- `agov --version`
- `agov check`
- `agov assess`
- `agov check --workspace <path> --profile <path>`
- `agov assess --workspace <path> --profile <path>`
- `agov check --adapter <package> --root <path> --profile <path>`
- `agov assess --adapter <package> --root <path> --profile <path>`

The CLI resolves values in this order:

- explicit flags
- config file
- conventional file discovery
- generic adapter candidate discovery and probe-based selection
- error with guidance

## Runtime Modes

The standalone host currently supports:

- canonical workspace documents in `.json`, `.yaml`, or `.yml`
- standalone profile documents in `.json`
- explicit adapter mode through `--adapter <package> --root <path>`
- generic adapter candidate discovery through config or package metadata
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

Programmatic CLI parsing and exit-code execution are also available:

```ts
import {
  AGOV_EXIT_SUCCESS,
  parseAgovCliArgs,
  runAgovCli,
} from '@anarchitects/governance-cli';

const parsed = parseAgovCliArgs(['check', '--help']);
const exitCode = await runAgovCli(['check', '--help']);

console.log(parsed.kind);
console.log(exitCode === AGOV_EXIT_SUCCESS);
```

## Adapter Model

`@anarchitects/governance-cli` is adapter-agnostic.

That means:

- the package depends on `@anarchitects/governance-core`, not on concrete adapter packages
- concrete adapters implement Core-owned contracts
- adapters may be injected, discovered, or dynamically loaded by package name
- future adapters must not require CLI package dependency changes

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
