# Governance: Bidirectional Architecture Reconciliation Roadmap

Status: **proposed product roadmap**, 2026-11-19. Coordinating epic: [Community #781](https://github.com/anarchitects/anarchitecture-community/issues/781). This is a forward-looking plan; listed features are **not** declarations that implementations exist or that releases are approved.

## North-star / product test

> Does implemented software still conform to approved architecture? What evidence establishes this, what changed, what gaps exist, and **where and in what order** should we intervene?

**Portable architecture-aware governance**, not an alternative to Nx Graph, Nx Conformance/Owners, Polygraph, GitHub, Backstage or a general modeling engine. Existing bottom-up TypeScript/Nx/dbt inventories, canonical rule assessment and snapshot/drift intelligence remain the baseline; the critical missing layer is an authoritative and testable **architecture intent → implementation evidence** reconciliation.

## Ownership and model boundary

| Capability | Owner | Contract |
| --- | --- | --- |
| Semantic modeling, authored model IDs, typed method packs, model revisions, semantic validation | Modeling Foundation | Versioned modeling artifacts; no governance enforcement, external I/O or evidence trust inference |
| Canonical inventory, normalized facts and evidence, deterministic policy/assessment | Community Governance Core | Workspace-local nodes/relations/assessments, source/authority/confidence/capability fields |
| Composition / identity / cross-workspace references | Community [#300](https://github.com/anarchitects/anarchitecture-community/issues/300) | **Proposed** GovernanceEnvironment, workspace-qualified references, source identity/version preserving composition |
| Source projection and method-specific meaning | Community adapters/extensions, with method ownership preserved | Intent projection and source-specific versioned extension contracts; separate observed-fact adapters |
| Nx targets, commands, Project Details, PR checks | Plugins | Nx host, not a duplicate semantic graph/rule engine |
| Cross-repo catalog/dependency/ownership authority | Meta | Accepted ADRs, owner review and release policy |

### Explicit decision gate: [Community #780](https://github.com/anarchitects/anarchitecture-community/issues/780)

The **bounded Modeling Foundation reuse spike** must compare (A) adapter-only, (B) shared primitives, (C) Foundation-backed Governance Core, and the no-integration case; produce a version-pinned semantic mapping matrix, synthetic proof and reasoned ADR/decision. **Adapter-only is the baseline for the proof, not a settled dependency decision.** Modeling Foundation currently has private 0.0.0 developer artifacts and does not implement general external reference resolution. No direct `governance-core → modeling-core` dependency, unverified ArchiMate support or cross-repo ownership change may be assumed.

## Logical flow

```text
approved architecture (model, ADR, contract)           observed code, data, CI and runtime
       |                 |                                      |
       +-- intent projection and source revision                +-- evidence adapters
                         |                                      |
                GovernanceWorkspace(intent)           GovernanceWorkspace(reality)
                         +----------------+---------------------+
                                          |
                             GovernanceEnvironment (#300)
                          qualified source refs / versioned mapping
                                          |
                     canonical architecture expectations (#783)
                                          |
                    realization mapping / traceability (#784)
                                          |
                      deterministic reconciliation (#785)
                  satisfied / violated / partial / unverified /
                         not-applicable / waived + coverage
                                          |
                      architecture baseline drift (#786)
                                          |
                      root causes / remediation DAG (#787)
                                          |
                     portable CLI/report export (#788)
                                          |
                  Nx host (#637) → change-aware PR gate (#638)
```

*Conceptual sequencing only; exact API shapes and method-specific semantics require ADRs/proofs. Intent and reality are separate; source nodes must never be silently merged.*

## Phases and tracked issues

| Order | Priority | Outcome / gate | Tracking |
| --- | --- | --- | --- |
| 0A | **P0** | Confirm foundation reuse boundary using implemented versioned artifacts; secure cross-repo owner approval before production dependency | [#780](https://github.com/anarchitects/anarchitecture-community/issues/780), [Meta #56](https://github.com/anarchitects/anarchitecture-meta/issues/56) |
| 0B | **P0** | Workspace-qualified composition, stable source identity, evidence/authority and explicit unsupported/unknown semantics | [#300](https://github.com/anarchitects/anarchitecture-community/issues/300) |
| 1A | **P1** | Versioned approved architecture intent inventory (synthetic first) | [#782](https://github.com/anarchitects/anarchitecture-community/issues/782) |
| 1B | **P1** | Explicit testable Architecture Expectations; separate descriptive model from normative obligation | [#783](https://github.com/anarchitects/anarchitecture-community/issues/783) |
| 1C | **P1** | Auditable realization mapping, cross-source IDs, confidence and ambiguous/unresolved diagnostics | [#784](https://github.com/anarchitects/anarchitecture-community/issues/784) |
| 2A | **P1** | Intent/reality/evidence assessment with precise gaps, unknown/waived and coverage; no false green | [#785](https://github.com/anarchitects/anarchitecture-community/issues/785) |
| 2B | **P1** | Repeatable multi-source CLI export and usable CI exit outcomes | [#788](https://github.com/anarchitects/anarchitecture-community/issues/788); reuse [#138](https://github.com/anarchitects/anarchitecture-community/issues/138), [#139](https://github.com/anarchitects/anarchitecture-community/issues/139), [#140](https://github.com/anarchitects/anarchitecture-community/issues/140), [#142](https://github.com/anarchitects/anarchitecture-community/issues/142) |
| 2C | **P1** | Nx-native host proof and architecture-aware PR check with positive/negative fixtures | [Plugins #637](https://github.com/anarchitects/anarchitecture-plugins/issues/637), [#638](https://github.com/anarchitects/anarchitecture-plugins/issues/638), [Meta #39](https://github.com/anarchitects/anarchitecture-meta/issues/39) |
| 3A | **P2** | Baseline drift: intent vs implementation vs mapping vs evidence; planned migration | [#786](https://github.com/anarchitects/anarchitecture-community/issues/786) |
| 3B | **P2** | Evidence-backed cause hypotheses and prioritized dependency-ordered remediation actions | [#787](https://github.com/anarchitects/anarchitecture-community/issues/787) |
| 3C | **P2** | Bounded declarative selectors/assessments after core semantics, not speculative universal DSL | [#316](https://github.com/anarchitects/anarchitecture-community/issues/316), [#317](https://github.com/anarchitects/anarchitecture-community/issues/317) |
| 4 | **Later** | Architecture Evidence Workbench and thin VS Code UX; independent of Nx-native UX feasibility | [#135](https://github.com/anarchitects/anarchitecture-community/issues/135), [#141](https://github.com/anarchitects/anarchitecture-community/issues/141) |

**Sequencing nuance:** #300 composition contracts can progress in parallel with #780. Synthetic intents can be designed, but the dependency/adoption choice and implementation of #782 should not precede #780. Minimal remediation/action recommendations can accompany the vertical slice; full root-cause ranking and drift taxonomy do not block first value proof. Stable contract versions and reproducibility do block it.

## Minimal end-to-end vertical slice

Create an **approved synthetic** capability → application component/service → target Nx implementation and expected API/contract/evidence. Verify:

1. Implemented, mapped, authorized and tested → **satisfied**, with source/model/commit revision and evidence.
2. Required component absent and absence demonstrable with complete discovery → **violated**; exact expected element and implementation scope.
3. Forbidden dependency introduced in a PR → clear violation, exact source location, impact and suggested fix.
4. Mapping ambiguous, adapter unavailable or evidence missing → **unverified**, never satisfied.
5. Planned migration/approved exception → distinct status; no silent policy weakening.
6. Reassessment after a developer's change shows resolved gaps without misattributing unrelated findings.
7. CLI/PR output reports source revisions, mapping provenance, capabilities, coverage, known/unknown findings and correct place of intervention.

Record false-positive/false-negative checks and time to diagnose/resolve in [Meta #39](https://github.com/anarchitects/anarchitecture-meta/issues/39). No proprietary Blueprint assets or licensed ArchiMate diagrams are prerequisites.

## Design invariants

- **Separate sources of truth:** authored intent ≠ documented claim ≠ discovered fact ≠ inferred mapping ≠ verified runtime evidence.
- **No false evidence:** unresolved identity, missing capability, failed source fetch and stale verification produce incomplete/unknown results, not success.
- **Cross-source identity:** use qualified stable refs and explicit/provenance-bearing mappings; names alone do not establish equivalence; one-to-many is valid.
- **Reproducible assessment:** pin model revisions, profiles, rule/extension versions, source snapshots and environment scope.
- **Correct intervention:** distinguish change code, update the model/ADR, repair mapping, collect evidence, or approve a scoped exception.
- **Evidence-backed ordering:** remediation dependency DAG, impact/criticality, severity, evidence confidence, owner and optional effort; no invented owner, effort or certainty.
- **Portable by default:** Community Core independent of Nx/ArchiMate/dbt hosts; source-specific adapter/extension contracts stay versioned outside Core.
- **No false equivalence:** a model relationship is not itself a verified executable policy; derive explicit approved expectations.
- **No second developer platform:** use Nx-native graph/CI and GitHub issues where supported, not a proprietary replacement.

## Adjacent backlog reconciliation

- Community [#318](https://github.com/anarchitects/anarchitecture-community/issues/318): YAML profile ergonomics, independently useful but **not a blocker** for the slice.
- Community [#136](https://github.com/anarchitects/anarchitecture-community/issues/136): Angular adapter deferred until supported source-specific governance need.
- Plugins [#40](https://github.com/anarchitects/anarchitecture-plugins/issues/40): bound to Nx/Polygraph feasibility and entitlement, not GovernanceEnvironment implementation.
- Plugins [#444](https://github.com/anarchitects/anarchitecture-plugins/issues/444): project metadata projection first, test native Graph/Project Details API limits before promising overlays.
- Plugins [#39](https://github.com/anarchitects/anarchitecture-plugins/issues/39): reconcile AI handoff backlog with existing implemented payloads; agent outputs grounded in evidence.
- Older [Core technology migration roadmap](governance-core-multi-technology-roadmap.md) is a historical implementation/migration record, **not current guidance** for removed `GovernanceProject`/`GovernanceDependency` compatibility contracts. Current canonical model is `GovernanceWorkspace.nodes/relations`; use package READMEs and accepted ADRs as the existing behavior reference.

## Maintenance and delivery discipline

Issues describe work and sequencing, not proof of completion. Update statuses only after code/tests/release evidence. Native GitHub parent/sub-issue and blocking links should be set via GraphQL/`gh` if connector mutations are unavailable; Markdown crosslinks are no substitute. Avoid inventing schedules, owners, Nx enterprise entitlements, or release approvals.
