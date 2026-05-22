# `@anarchitects/governance-cli`

Standalone Governance host/runtime APIs for running Governance checks outside Nx.

## Overview

`@anarchitects/governance-cli` provides the standalone host surface for Community-owned Governance packages. It turns explicit input documents into Governance assessments and renders the result through package-internal reporting helpers.

The current public package surface is library-oriented. The package does not currently publish a `bin` entry, so the supported entrypoint is the exported runtime API rather than a packaged shell command.

## Responsibilities

This package is responsible for:

- loading explicit standalone Governance profile documents
- loading explicit manual Governance workspace documents
- orchestrating Governance evaluation through `@anarchitects/governance-core`
- returning a structured Governance check result from the public API
- keeping argv parsing, exit handling, and report rendering as host concerns

This package is not responsible for:

- canonical Governance contracts
- concrete adapter implementations
- TypeScript adapter implementation details
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

The following APIs exist in source but are not part of the public barrel:

- `runAgovCli(...)`
- argv parsing helpers
- exit-code helpers
- rendering helpers
- manual-workspace loader internals

## Usage

The current library-style entrypoint accepts explicit file paths for a standalone workspace document and a standalone Governance profile:

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
- report rendering formats `json`, `markdown`, and `table` through internal host code

## Adapter Model

The intended consumer model for this package is adapter-agnostic:

- the CLI/runtime host should depend on `@anarchitects/governance-core`
- concrete adapters should implement Core-owned contracts
- concrete adapters should be supplied, registered, injected, or resolved through Core-owned abstractions
- adding a future adapter should not require changing this package’s public contract

That is the model package consumers should follow.

## Binary Packaging

This package does not currently declare a `bin` entry in `package.json`.

That means:

- no packaged `agov` command is documented here yet
- no shell command usage is part of the current public contract
- hosts should use the exported runtime API directly

## Package Boundaries

`@anarchitects/governance-cli` is a standalone host/runtime package.

It should:

- orchestrate Core APIs
- accept explicit inputs from a caller or wrapper
- stay separate from canonical model ownership

It should not:

- become the home of canonical Governance contracts
- own concrete adapter implementations
- require CLI package changes every time a new adapter is introduced
- take on Nx-only responsibilities

## Related Packages

- `@anarchitects/governance-core` owns canonical contracts and deterministic Governance logic
- `@anarchitects/governance-adapter-typescript` is a sibling concrete adapter package for TypeScript workspace discovery, but it should not be treated as part of the CLI package’s desired dependency model
