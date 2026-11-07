# Community ownership

Community provides reusable public packages. The roles below separate package
scope and release authority from repository technical maintenance. One person may
hold several roles; each decision still belongs to its applicable role.

The [central ownership register](https://github.com/anarchitects/anarchitecture-meta/blob/main/docs/ownership.md)
is authoritative for ecosystem assignments. This local record applies those
assignments to Community's package inventory. The [Community operating model](docs/sdlc.md)
explains delivery, acceptance and release responsibilities.

## Roles

| Scope                           | Role                        | Person | Responsibility                                                                                                  |
| ------------------------------- | --------------------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| Anarchitects ecosystem          | Architecture and SDLC owner | PWG    | Ecosystem policy and architecture authority                                                                     |
| Community repository            | Technical maintainer        | Johan  | Repository/package quality and technical readiness                                                              |
| Auth                            | Domain owner                | Johan  | Auth scope, compatibility, acceptance and release authorization, including the Better Auth TypeORM adapter      |
| Governance in Community         | Capability owner            | Johan  | Governance scope, compatibility, acceptance and release authorization                                           |
| SSR in Community                | Capability owner            | Johan  | SSR scope, compatibility, acceptance and release authorization                                                  |
| Visual Composition in Community | Capability owner            | Johan  | Visual Composition scope, compatibility, acceptance and release authorization, including all Editor.js packages |

The central register confirms these people and roles. Johan explicitly confirmed
the Better Auth → Auth and Editor.js → Visual Composition package mappings on
7 November 2026 during [#716](https://github.com/anarchitects/anarchitecture-community/issues/716).
Those mappings refine existing assignments; they do not introduce a new domain
or transfer shared public HTTP contract ownership from Contracts.

No Community App PO, backup owner or automatic delegation is assigned here.
Competing priorities are resolved jointly by the involved owners. Neither a
technical-maintainer role nor repository access alone grants release authority.

## Package inventory

Inventory reviewed on 7 November 2026: all 21 projects in the workspace's Nx
release selection. These are ownership assignments, not assertions that every
package/version is published or ready for release. All listed packages remain
independently versioned under [Community ADR0007](docs/adr/0007-package-initial-release-and-nx-versioning.md).
Mapping the Better Auth adapter to Auth does not make it part of a Bricks
domain-aligned release group or move its implementation out of Community.

| Nx project                        | Package/distribution identity                   | Owning domain/capability        | Owner |
| --------------------------------- | ----------------------------------------------- | ------------------------------- | ----- |
| `better-auth-typeorm-adapter`     | `@anarchitects/better-auth-typeorm-adapter`     | Auth                            | Johan |
| `nest-angular-ssr`                | `@anarchitects/nest-angular-ssr`                | SSR in Community                | Johan |
| `governance-core`                 | `@anarchitects/governance-core`                 | Governance in Community         | Johan |
| `governance-adapter-typescript`   | `@anarchitects/governance-adapter-typescript`   | Governance in Community         | Johan |
| `governance-adapter-dbt`          | `@anarchitects/governance-adapter-dbt`          | Governance in Community         | Johan |
| `governance-extension-typescript` | `@anarchitects/governance-extension-typescript` | Governance in Community         | Johan |
| `governance-extension-dbt`        | `@anarchitects/governance-extension-dbt`        | Governance in Community         | Johan |
| `governance-runtime-dbt`          | `@anarchitects/governance-runtime-dbt`          | Governance in Community         | Johan |
| `governance-cli`                  | `@anarchitects/governance-cli`                  | Governance in Community         | Johan |
| `governance-host-dbt`             | `anarchitecture-dbt-governance` (Python)        | Governance in Community         | Johan |
| `governance-dbt-package`          | `anarchitects_governance` (dbt)                 | Governance in Community         | Johan |
| `editorjs-core`                   | `@anarchitects/editorjs-core`                   | Visual Composition in Community | Johan |
| `editorjs-angular`                | `@anarchitects/editorjs-angular`                | Visual Composition in Community | Johan |
| `editorjs-tool-paragraph`         | `@anarchitects/editorjs-tool-paragraph`         | Visual Composition in Community | Johan |
| `editorjs-tool-header`            | `@anarchitects/editorjs-tool-header`            | Visual Composition in Community | Johan |
| `editorjs-tool-list`              | `@anarchitects/editorjs-tool-list`              | Visual Composition in Community | Johan |
| `editorjs-tool-quote`             | `@anarchitects/editorjs-tool-quote`             | Visual Composition in Community | Johan |
| `editorjs-tool-image`             | `@anarchitects/editorjs-tool-image`             | Visual Composition in Community | Johan |
| `editorjs-upload-fetch`           | `@anarchitects/editorjs-upload-fetch`           | Visual Composition in Community | Johan |
| `editorjs-html`                   | `@anarchitects/editorjs-html`                   | Visual Composition in Community | Johan |
| `editorjs-html-angular`           | `@anarchitects/editorjs-html-angular`           | Visual Composition in Community | Johan |

The seven other current Nx projects are internal validation or workspace tooling:
`nest-cjs-consumer`, `nest-esm-consumer`, `nest-angular-split-backend`,
`nest-angular-split-frontend`, `editorjs-angular-host`, `editorjs-angular-e2e` and
`@anarchitecture-community/source`. Johan maintains them as repository assets;
their acceptance supports the relevant package owners. They are not independently
deployed application products or shared private distribution packages.

Future Visual Composition implementations, including the work planned in
[#517](https://github.com/anarchitects/anarchitecture-community/issues/517), use
the confirmed capability owner but need explicit package-inventory entries when
introduced. This record does not claim those future packages exist.

## Maintaining the record

- When introducing or moving a publishable package, update its exact Nx project,
  distribution identity and owner mapping here. Confirm uncovered scopes with the
  affected owners before treating the work as Ready or authorizing its release.
- When a person, role, capability boundary or delegation changes, coordinate the
  central register and this file, linking the accepted decision and effective
  change. A local edit cannot silently change ecosystem authority. Record any
  mismatch as a blocker for the affected decision until reconciled.
- Use the confirmed names PWG and Johan. This document does not infer GitHub
  usernames, teams or bot permissions. The release-control work must verify any
  identity-to-role mapping it uses against the confirmed owner before enforcement.
- Record owner acceptance in the relevant issue/PR. Issue assignment, a green
  check or a bot-created tag alone is not evidence of that acceptance.

## Policy reference

Reviewed against the [central register at Meta `770b6d67`](https://github.com/anarchitects/anarchitecture-meta/blob/770b6d67d7a4479ec0226f0ac48beeb2534db6a2/docs/ownership.md)
and [merged Meta PR #49](https://github.com/anarchitects/anarchitecture-meta/pull/49).
Follow the current accepted Meta decisions when these records evolve; preserve
the distinction between a dated review and current operational enforcement.
