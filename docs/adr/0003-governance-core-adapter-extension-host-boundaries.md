# ADR 0003: Governance Boundaries for Canonical Core, Adapters, Extensions, and Hosts

## Status

Accepted

## Context

Epic #357 and the first follow-up architecture issues exposed a recurring boundary problem in the Governance stack.

`@anarchitects/governance-core`, concrete adapters, concrete extensions, and executable hosts currently follow the general direction established in ADR 0001 and ADR 0002, but important ownership details are still implicit. That has already created confusion around:

- ownership mapping and canonical ownership coverage
- whether profile fields belong to Core or to a technology-specific package
- whether adapter discovery rules may project architectural meaning
- whether diagnostics may imply unsupported ownership sources
- which rules apply to which inventory subjects
- where adapter and extension runtime options belong

Without a stricter boundary decision, the current Governance stack risks repeating the same mistakes across TypeScript, dbt, GitHub, Nx, Angular, and future ecosystems:

- Core absorbs ecosystem-specific fields and stops being canonical
- adapters become semantic owners of technology-specific interpretation
- extensions rely on undocumented implicit payloads
- hosts collapse canonical policy, extraction config, and interpretation config into one misleading profile surface

The Governance stack needs an explicit architectural decision that separates:

- canonical baseline model ownership
- extension-owned model expansion ownership
- adapter normalization responsibilities
- host orchestration and configuration responsibilities

This ADR defines those ownership boundaries and the placement rules that follow from them.

## Decision

The Governance stack uses a boundary model with four distinct ownership layers:

- `@anarchitects/governance-core` owns the canonical baseline model and generic governance semantics.
- governance adapters own source extraction and normalization into canonical Core fields and extension-owned expansion contracts.
- governance extensions own technology-specific interpretation and any explicit model expansion contract beyond the canonical Core model.
- governance hosts own runtime orchestration and configuration routing across canonical, adapter-specific, and extension-specific configuration layers.

The canonical governance profile remains Core-owned and canonical-policy-only.

Core must not contain TypeScript-, dbt-, GitHub-, Nx-, Angular-, or other ecosystem-specific profile fields, model fields, or validation rules unless those fields are truly generic governance concepts.

Extensions may define explicit model expansion contracts on top of the canonical model. The owning extension is responsible for documenting, validating, versioning, and evolving that expansion surface.

Adapters normalize source facts into Core-owned canonical fields only when the fact is genuinely generic and stable across technologies. Adapters normalize technology-specific facts into extension-owned expansion surfaces where appropriate.

Adapters must not become semantic owners of extension behavior. They may extract and transport extension-relevant facts, but the meaning, validation, and interpretation of extension-owned facts remain owned by the extension.

Hosts route configuration across three distinct layers:

- canonical governance profile config
- adapter-specific extraction and normalization config
- extension-specific interpretation config

Adapter-specific config does not belong in the canonical governance profile.

Extension-specific config does not belong in the canonical governance profile.

## Consequences

Positive consequences:

- Core remains small, canonical, and reusable across ecosystems.
- Extensions can evolve technology-specific meaning without forcing Core changes.
- Adapters can stay focused on extraction and normalization rather than policy semantics.
- Hosts can compose canonical policy with technology-specific runtime behavior without implying that everything is part of one canonical profile contract.
- Follow-up issues can harden contracts by ownership boundary instead of by package accident.

Trade-offs:

- Hosts need more explicit config plumbing.
- Extensions must publish and maintain their own contract documentation instead of relying on implicit metadata.
- Adapters may need to emit both canonical facts and extension-owned facts for the same discovered subject.
- Existing packages that currently blur boundaries need migration work even when backward compatibility is not required.

Non-decisions:

- This ADR does not define the final concrete transport shape for extension-owned expansion payloads.
- This ADR does not make adapters depend directly on extension implementations.
- This ADR does not move technology-specific behavior into Core for convenience.

## Ownership Boundaries

### `@anarchitects/governance-core`

Core owns:

- the canonical baseline governance model
- canonical profile contracts and validation
- generic governance semantics
- generic rule, signal, metric, diagnostic, and assessment semantics
- generic applicability and capability concepts
- generic runtime contracts used by adapters, extensions, and hosts

Core must not own:

- TypeScript-specific model or profile fields
- dbt-specific model or profile fields
- GitHub-specific ownership behavior
- Nx-specific runtime or config behavior
- Angular-specific config or interpretation behavior
- adapter-local discovery rule formats
- extension-local interpretation config formats

Core may expose generic extension points and generic carriers for non-canonical data, but it must not own the meaning of extension-specific fields.

### Governance Extensions

Extensions own:

- explicit model expansions beyond the canonical Core model
- technology-specific interpretation semantics
- technology-specific rules, signals, metrics, diagnostics, and recommendations
- validation of extension-specific config and extension-specific expansion payloads
- versioning and migration of their extension-owned contract surfaces

Extensions must not:

- smuggle technology-specific profile fields into the canonical profile
- rely on undocumented adapter-private payloads as public contract
- force Core to learn the meaning of extension-specific fields
- become executable hosts

If an extension needs a new non-canonical field, the field belongs to the extension-owned contract, not to Core by default.

### Governance Adapters

Adapters own:

- source detection and extraction
- source artifact parsing and validation
- discovery heuristics
- normalization of genuinely generic facts into canonical Core fields
- projection of technology-specific facts into extension-owned expansion contracts where appropriate
- extraction diagnostics and provenance for the facts they emit

Adapters must not own:

- canonical policy semantics
- extension interpretation semantics
- host config policy
- long-term ownership of extension contracts they do not define

Adapters may apply deterministic normalization rules, but they must not redefine what an extension-owned concept means.

### Governance Hosts

Hosts own:

- runtime loading of Core, adapters, and extensions
- execution orchestration
- configuration loading and precedence
- routing config to the correct owning layer
- output and report rendering
- environment-specific runtime concerns such as credentials, paths, and process behavior

Hosts must not:

- collapse adapter and extension config into the canonical profile
- silently redefine canonical semantics
- imply support for ownership or diagnostic sources that are not active in the current flow

The current standalone CLI is a host. Future service runtimes, repository bots, CI entrypoints, and UI-driven runners are also hosts.

## Configuration Placement Rules

Use these rules:

- Canonical governance policy belongs in the Core-owned governance profile.
- Adapter extraction, discovery, projection, and normalization options belong in adapter or host config surfaces.
- Extension interpretation, rules, metrics, signals, thresholds, and enrichment options belong in extension or host config surfaces.
- Hosts are responsible for composing the three layers without redefining their ownership.

The canonical profile may reference canonical governance concepts such as:

- policies
- canonical ownership expectations
- canonical domain, layer, and scope expectations
- generic rule configuration that is defined by Core

The canonical profile must not absorb technology-specific options such as:

- TypeScript discovery rule config
- TypeScript signal toggles that are owned by a TypeScript extension
- dbt artifact loading options
- dbt interpretation thresholds owned by a dbt extension
- GitHub ownership mapping options

Host configuration may therefore contain shapes such as:

```json
{
  "profile": "./governance.profile.json",
  "adapter": "@anarchitects/governance-adapter-typescript",
  "extensions": ["@anarchitects/governance-extension-typescript"],
  "adapterOptions": {
    "typescript": {
      "discoveryConfig": {}
    }
  },
  "extensionOptions": {
    "typescript": {
      "signals": {},
      "metrics": {}
    }
  }
}
```

The exact transport shape is a host concern and may evolve, but the ownership split above is mandatory.

## Examples

### TypeScript Governance Flow

Canonical TypeScript-discovered facts may normalize into Core fields when they are genuinely architectural and not TypeScript-specific, for example:

- canonical ownership derived from declared project metadata
- canonical domain when a package is explicitly mapped to a business domain
- canonical layer when a package is explicitly mapped to an architectural layer
- canonical scope when a package is explicitly mapped to a stable governance scope

TypeScript-specific facts should not expand Core implicitly, for example:

- `tsconfig` structure and inheritance
- path alias definitions
- import graph parsing artifacts
- source-file conventions
- TypeScript compiler settings
- TypeScript-only diagnostics and metrics

Those facts belong either in adapter-local extraction behavior or in a TypeScript extension-owned interpretation/model expansion surface.

Host routing for TypeScript must keep these concerns separate:

- `governance.profile.json` contains canonical policy only
- TypeScript discovery and projection config lives in adapter or host config
- TypeScript signals and metrics config lives in extension or host config

The host must not require users to encode TypeScript extraction behavior into the canonical profile.

### dbt Governance Flow

The dbt adapter is responsible for extracting dbt artifacts and normalizing genuinely generic facts into the canonical model where appropriate.

Examples:

- canonical nodes and relations for governable dbt subjects when those concepts fit the baseline model
- provenance linking a canonical fact back to a dbt manifest or catalog artifact

The dbt extension owns dbt-specific interpretation and model expansion, for example:

- dbt-specific artifact semantics
- dbt-only signals and metrics
- dbt-specific recommendations
- any dbt expansion contract beyond the canonical Core model

The dbt runtime or host must not collapse:

- dbt adapter extraction config
- dbt extension interpretation config
- canonical governance profile policy

into a single canonical profile surface.

## Migration Guidance

Apply these migration rules to current Governance packages:

- `@anarchitects/governance-core` should keep only canonical baseline fields, contracts, and validation. Ecosystem-specific profile or model fields should move out of Core unless they are proven generic.
- `@anarchitects/governance-cli` and any future host should expose distinct config surfaces for canonical profile, adapter config, and extension config.
- `@anarchitects/governance-adapter-typescript` should normalize generic architectural facts into canonical fields and place TypeScript-specific projections into a TypeScript-owned expansion contract rather than growing Core implicitly.
- `@anarchitects/governance-extension-typescript` should document and own the TypeScript-specific contract surface it expects and interprets.
- `@anarchitects/governance-adapter-dbt` should normalize dbt extraction into canonical and dbt-owned targets without becoming the semantic owner of dbt interpretation.
- `@anarchitects/governance-extension-dbt` should define and own the dbt-specific interpretation and expansion contract.

Follow-up implementation should prefer removing misleading contract surface over preserving unstable compatibility.

When an existing field or config location is ambiguous, resolve it by asking two questions:

1. Is the concept genuinely generic across governance technologies?
2. If not, which extension or adapter is the real semantic owner?

If the answer to the first question is no, the field does not belong to Core by default.

## Related Issues

- #357 Epic: clarify canonical core model, extension-owned model expansions, and adapter/host boundaries
- #358 Governance Architecture: ADR for canonical core model and extension-owned model expansions
- #359 Governance Architecture: define host config layering for profile, adapter, and extension config
- #360 Governance Architecture: harden governance-core canonical contract boundaries
- #361 Governance Architecture: define extension-owned model expansion contract
- #362 Governance Architecture: align TypeScript adapter normalization with canonical and extension-owned targets
- #363 Governance Architecture: align dbt runtime and host boundaries with canonical config layering
- #364 Governance Architecture: update docs and examples for Core, adapter, extension, and host boundaries
