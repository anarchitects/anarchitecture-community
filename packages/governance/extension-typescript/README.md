# @anarchitects/governance-extension-typescript

## Overview

`@anarchitects/governance-extension-typescript` provides the TypeScript
Governance extension package. It defines the extension identity, metadata, and
registration entrypoint used by hosts that want to compose TypeScript-specific
Governance interpretation through public `@anarchitects/governance-core`
extension contracts.

Use this package when a Governance host should load TypeScript-specific
extension contributions separately from TypeScript workspace extraction.

## Key Concepts

- The extension is a Core-compatible `GovernanceExtensionDefinition`.
- Extension metadata describes the package identity, technology, and
  responsibility boundary.
- Registration is performed by a host through the Core extension runtime.
- The package is separate from `@anarchitects/governance-adapter-typescript`;
  extraction and interpretation are different responsibilities.

## Installation

```bash
npm install @anarchitects/governance-extension-typescript
```

Hosts that register the extension also need `@anarchitects/governance-core`.

## Quick Start

```ts
import {
  governanceTypeScriptExtension,
  typescriptGovernanceExtensionMetadata,
} from '@anarchitects/governance-extension-typescript';

console.log(typescriptGovernanceExtensionMetadata.technology);

// Pass governanceTypeScriptExtension to a Governance host that accepts
// Core-compatible extension definitions.
```

## Architecture

```text
Governance host
  -> loads @anarchitects/governance-extension-typescript
  -> registers the GovernanceExtensionDefinition
  -> composes TypeScript-specific interpretation with Core assessment data
```

Dependency direction:

```text
@anarchitects/governance-extension-typescript
  -> @anarchitects/governance-core
```

The extension does not depend on the TypeScript adapter, CLI, or reporting
packages.

## Responsibilities

This package owns:

- TypeScript extension identity
- TypeScript extension metadata
- TypeScript extension registration entrypoints
- TypeScript-specific Governance interpretation contributions provided by this
  package

This package does not own:

- TypeScript workspace extraction
- TypeScript project discovery
- `tsconfig` parsing
- import graph discovery
- adapter result creation
- CLI orchestration
- report rendering
- canonical Governance Core semantics

## Public API

The package publishes one root entrypoint:

```ts
import {
  TYPESCRIPT_GOVERNANCE_EXTENSION_ID,
  createTypeScriptGovernanceExtension,
  governanceTypeScriptExtension,
  registerTypeScriptGovernanceExtension,
  typescriptGovernanceExtensionMetadata,
  type TypeScriptGovernanceExtensionMetadata,
} from '@anarchitects/governance-extension-typescript';
```

Public exports:

- `TYPESCRIPT_GOVERNANCE_EXTENSION_ID`
- `typescriptGovernanceExtensionMetadata`
- `governanceTypeScriptExtension`
- `createTypeScriptGovernanceExtension(...)`
- `registerTypeScriptGovernanceExtension(...)`
- `TypeScriptGovernanceExtensionMetadata`
- default export: `governanceTypeScriptExtension`

## Usage

### Register With A Host

Hosts that accept Core `GovernanceExtensionDefinition` values can register the
extension directly:

```ts
import { governanceTypeScriptExtension } from '@anarchitects/governance-extension-typescript';

const extensions = [governanceTypeScriptExtension];
```

### Create A Fresh Definition

Use the factory when a host wants a fresh extension definition value:

```ts
import { createTypeScriptGovernanceExtension } from '@anarchitects/governance-extension-typescript';

const extension = createTypeScriptGovernanceExtension();
```

## Configuration

This package does not read configuration files. Hosts provide configuration and
registration context through Core extension runtime APIs.

## Extension Points

The package boundary is intended for TypeScript-specific Governance
interpretation. Workspace discovery stays in the TypeScript adapter, while hosts
compose adapter output, Core assessment data, and extension contributions.

## Related Packages

- `@anarchitects/governance-core` owns extension contracts and runtime helper
  contracts consumed by this package.
- `@anarchitects/governance-adapter-typescript` discovers TypeScript workspace
  facts and emits Core adapter results.
- `@anarchitects/governance-cli` can act as a host that loads Governance
  adapters and extensions.

## Compatibility

This package depends only on public `@anarchitects/governance-core` contracts.
It does not import adapter, CLI, or reporting internals.

## FAQ

### Is this package the TypeScript adapter?

No. The adapter extracts workspace facts. This extension package owns
TypeScript-specific interpretation.

### Can the extension depend on the adapter?

No. Hosts compose adapter output and extension registration through Core
contracts.

### Does this package render reports?

No. Report rendering is a host or reporting responsibility.

## License

MIT
