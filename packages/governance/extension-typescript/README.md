# @anarchitects/governance-extension-typescript

## Overview

`@anarchitects/governance-extension-typescript` provides the TypeScript
Governance extension package. It defines the extension identity, metadata, and
registration entrypoint used by hosts that want to compose TypeScript-specific
Governance interpretation through public `@anarchitects/governance-core`
extension contracts.

Use this package when a Governance host should load TypeScript-specific
extension contributions separately from TypeScript workspace extraction.

Package boundaries follow
[ADR 0001](../../../docs/adr/0001-governance-package-boundaries.md).

## Key Concepts

- The extension is a Core-compatible `GovernanceExtensionDefinition`.
- Extension metadata describes the package identity, technology, and
  responsibility boundary.
- Registration is performed by a host through the Core extension runtime.
- The package is separate from `@anarchitects/governance-adapter-typescript`;
  extraction and interpretation are different responsibilities.
- The extension consumes canonical `workspace.nodes` and `workspace.relations`
  and emits canonical references such as `nodeId`, `relationId`,
  `relatedNodeIds`, and `relatedRelationIds`.

## Installation

```bash
npm install @anarchitects/governance-extension-typescript
```

Hosts that register the extension also need `@anarchitects/governance-core`.

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

## Usage

### Register With A Host

```ts
import { governanceTypeScriptExtension } from '@anarchitects/governance-extension-typescript';

const extensions = [governanceTypeScriptExtension];
```

### Create A Fresh Definition

```ts
import { createTypeScriptGovernanceExtension } from '@anarchitects/governance-extension-typescript';

const extension = createTypeScriptGovernanceExtension();
```

### Canonical Runtime References

The extension consumes canonical node/relation workspaces and emits canonical
references:

```ts
{
  reference: {
    nodeId: 'package:checkout',
    relatedNodeIds: ['package:shared'],
  },
}

{
  reference: {
    relationId: 'ts:dependency:package:checkout->package:shared',
    relatedNodeIds: ['package:checkout', 'package:shared'],
    relatedRelationIds: ['ts:dependency:package:checkout->package:shared'],
  },
}
```

## Related Packages

- `@anarchitects/governance-core` owns extension contracts and runtime helper
  contracts consumed by this package.
- `@anarchitects/governance-adapter-typescript` discovers TypeScript workspace
  facts and emits canonical Core adapter results.
- `@anarchitects/governance-cli` can act as a host that loads Governance
  adapters and extensions.

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

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository [LICENSE](../../../LICENSE) and [NOTICE](../../../NOTICE) files.
