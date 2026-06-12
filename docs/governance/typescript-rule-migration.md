# TypeScript Governance Rule Migration

## Purpose

This document records the #238 review of current Governance Core rule
implementations before moving TypeScript-specific rules into
`@anarchitects/governance-extension-typescript`.

The intent of #238 is architectural relocation, not redesign. Rules should move
only when they are tied to TypeScript semantics such as `tsconfig`, imports,
exports, path aliases, module structure, barrels, circular imports, or other
TypeScript-specific facts.

## Current Rule Inventory

The current Core rule implementations live in
`packages/governance/core/src/core/evaluation/built-in-rules.ts`.

| Rule id                   | Classification | Current owner   | Reason                                                                                                                                                 |
| ------------------------- | -------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `domain-boundary`         | Generic        | Governance Core | Evaluates declared project domains and project-to-project dependencies. It does not inspect TypeScript source, imports, `tsconfig`, or path aliases.   |
| `layer-boundary`          | Generic        | Governance Core | Evaluates declared architectural layers and dependency direction. It is based on generic layer metadata, not TypeScript module semantics.              |
| `ownership-presence`      | Generic        | Governance Core | Evaluates canonical ownership on governed projects. It is not tied to TypeScript extraction.                                                           |
| `project-name-convention` | Generic        | Governance Core | Evaluates configured project naming conventions using a regular expression. The concept is generic even when TypeScript adapters provide the projects. |
| `tag-convention`          | Generic        | Governance Core | Evaluates generic tag prefixes and values. It is not tied to TypeScript tag sources.                                                                   |
| `missing-domain`          | Generic        | Governance Core | Evaluates whether generic domain metadata is present when configured.                                                                                  |
| `missing-layer`           | Generic        | Governance Core | Evaluates whether generic layer metadata is present when configured.                                                                                   |

## TypeScript-Specific Rules Found

No existing Governance Core rule implementation is currently TypeScript-specific.

The review found no Core rule implementation for:

- `tsconfig` analysis.
- import or export analysis.
- path alias analysis.
- barrel usage analysis.
- circular import analysis.
- TypeScript module structure analysis.
- TypeScript-specific dependency interpretation.

## Migration Outcome

No rule implementation was moved in #238 because there is no current
TypeScript-specific rule implementation in Governance Core.

The generic Core rules remain in Core. This preserves existing behavior and
avoids moving generic governance semantics into a technology-specific extension.

`@anarchitects/governance-extension-typescript` remains the target package for
future TypeScript-specific rules. When such rules are introduced or migrated,
they should be registered through the Core extension contracts and must not
depend on `@anarchitects/governance-adapter-typescript`, `@anarchitects/governance-cli`,
or reporting internals.

## Behavior Preservation

Because no existing rule moved:

- Existing Core rule identifiers remain unchanged.
- Existing Core rule findings remain unchanged.
- Existing CLI policy evaluation remains unchanged.
- The TypeScript extension does not duplicate generic Core rule findings.
- No adapter, CLI, reporting, or Core contract changes are required.

## Remaining Responsibilities

Governance Core retains:

- rule contracts
- rule engine primitives
- generic project/dependency policy rules
- generic metadata and ownership policy rules

`@anarchitects/governance-extension-typescript` owns future:

- TypeScript-specific rule implementations
- TypeScript-specific rule registration
- TypeScript-specific interpretation of canonical nodes, relations,
  capabilities, and diagnostics

## Follow-Up

#239 remains the follow-up for TypeScript-specific metrics and recommendations.
