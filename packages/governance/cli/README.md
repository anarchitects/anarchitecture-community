# `@anarchitects/governance-cli`

Platform-independent standalone Governance CLI owned by `anarchitects/anarchitecture-community`.

This package is part of the Governance split and now owns the extracted standalone CLI host from `anarchitects/anarchitecture-plugins/packages/governance/src/standalone-cli`.

Public API:

```ts
import { runAgovCheck } from '@anarchitects/governance-cli';
```

Current command surface:

- The stable public library-style seam is `runAgovCheck`.
- `runAgovCli`, argv parsing, exit-code handling, and report rendering remain internal CLI host code.
- No package `bin` field is exposed yet in this repository.

Binary entrypoint decision:

- The plugin-side `bin/agov.ts` source was not promoted into a published `bin` entry in this issue.
- Rationale: `anarchitecture-community` does not currently have an established package `bin` build convention, and the existing Nx/Vite library pattern builds a single root entrypoint consistently.

Manual workspace ownership decision:

- `manual-workspace` remains CLI-internal for now.
- Rationale: the readiness docs classify it as transitional and useful to the standalone CLI, but not yet a stable standalone adapter package contract.
- The CLI currently preserves the existing manual YAML/JSON workspace host flow instead of inventing a new adapter mode during extraction.

Package responsibilities:

- load explicit standalone governance profile JSON input
- load and validate explicit manual YAML/JSON workspace input
- normalize those inputs into canonical `@anarchitects/governance-core` contracts
- run deterministic Governance evaluation
- render deterministic JSON, Markdown, and table output internally

Dependencies and boundaries:

- depends on `@anarchitects/governance-core` for canonical contracts and deterministic Core logic
- is adapter-agnostic at the package boundary
- receives concrete adapters through Core-owned contracts when a host chooses to inject one
- does not depend on `@anarchitects/governance-adapter-typescript`
- does not expose or depend on Nx runtime behavior
- does not import from `anarchitects/anarchitecture-plugins`
- Nx-specific Governance execution remains in `anarchitects/anarchitecture-plugins`

Standalone execution assumptions:

- the current extracted CLI preserves the existing manual `--workspace <governance.workspace.json|yaml>` host flow
- there is still no implemented `--adapter typescript` CLI mode in this package
- a future convenience wrapper or published binary may choose to install and inject a concrete adapter package without changing this package
- standalone profiles are explicit JSON documents with a `name`
- Nx runtime profile override documents are rejected intentionally
- output formats remain `json`, `markdown`, and `table`

`anarchitects/anarchitecture-community` must not depend on `anarchitects/anarchitecture-plugins`.

Shared Governance guidance lives in:

- [`docs/governance-package-conventions.md`](../../../docs/governance-package-conventions.md)
- [`docs/governance-package-boundaries.md`](../../../docs/governance-package-boundaries.md)
- [`docs/governance-release-conventions.md`](../../../docs/governance-release-conventions.md)
- [`docs/governance-documentation-structure.md`](../../../docs/governance-documentation-structure.md)
