# Repository application: anarchitecture-community

Reviewed 2026-10-11 against branch `docs/adr-modern-angular-22`, starting commit `59851ec2d5933a71c21bc7ac73391295e2b07a75`. This inventory complements the [common guide](README.md); it does not replace reading every ADR in full. Re-enumerate ADRs when the branch changes.

## Actual baseline and scope

Angular ^22.0.0 root development dependency; Nx 23.2.1; TypeScript 6.0.3; Yarn 4.18.0.

Apply this guide to Angular UI/editor adapters, including the Editor.js and visual-composition workstreams. Governance canonical contracts remain technology-neutral; adapters extract, extensions enrich and hosts compose. Angular does not belong in governance core.

Keep rich-editor/browser code out of server module evaluation and public display bundles. Validate hydration and disposal in actual integrations. Public package READMEs must describe actual consumer exports and follow the separately accepted public package documentation policy (maintainer approval 2026-10-11).

## Complete local ADR inventory

All 5 records below were read. Status labels are preserved; a proposed amendment within an accepted record does not automatically become accepted.

| Record                                                                                                                                                     | Status at review                          | Constraint on this guide                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [ADR 0001: Governance Package Boundaries for Core, CLI, Adapters, and Extensions](../../adr/0001-governance-package-boundaries.md)                         | Accepted                                  | Core/CLI/adapters/extensions retain separate ownership and platform independence.                                     |
| [ADR 0002: Governance Core Multi-Technology Canonical Model](../../adr/0002-governance-core-multi-technology-canonical-model.md)                           | Accepted                                  | Use the small canonical multi-technology model; preserve additive compatibility.                                      |
| [ADR 0003: Governance Boundaries for Canonical Core, Adapters, Extensions, and Hosts](../../adr/0003-governance-core-adapter-extension-host-boundaries.md) | Accepted                                  | Adapters extract, extensions enrich and hosts compose; do not import Angular into core.                               |
| [ADR 0004: Public Package Documentation Policy](../../adr/0004-public-package-documentation.md)                                                            | Accepted (maintainer approval 2026-10-11) | Consumer-facing package documentation and packed README validation are required; contributor guidance stays separate. |
| [ADR: Modern Angular 22 and Signal Forms](../../adr/modern-angular-22-signal-forms.md)                                                                     | Accepted (maintainer approval 2026-10-11) | Accepted on 2026-10-11; adds source/API traceability and preserves local release gates.                               |

## Application gates

Apply A01–A12 only to the relevant Angular implementation/consumer scope. The [traceability matrix](traceability.md) covers the source chapters independently of whether this repository currently implements a topic. “Not currently applicable” is a scope decision, not permission to skip reading local ADRs.

Before implementation, inspect package-level peers and exports, applicable agent instructions, existing tests and resolved build targets. Before a release, validate the consumer and documented support range; a root dependency alone does not establish every package's compatibility. This change modifies documentation and agent instructions only. No runtime manifest, lockfile, public package API or release artifact is changed.
