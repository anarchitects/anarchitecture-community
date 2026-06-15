# dbt Governance Host

Status:
This document records the implemented `governance-host-dbt` behavior after the
#416 pre-documentation cleanup. It documents current behavior; it does not
introduce new runtime or package contracts.

## Purpose

Build it like an Nx product. Use it like a dbt tool.

`governance-host-dbt` is the dbt-native Python host for Governance checks. It
provides the user-facing dbt CLI while preserving the package ownership model
defined by ADR 0003.

The host product boundary is:

- dbt-native CLI UX
- config loading and precedence
- dbt artifact lifecycle orchestration
- pinned runtime setup and diagnostics
- process/JSON invocation of the runtime
- rendering, reports, and final exit-code mapping

The host is not the owner of dbt artifact normalization or governance
semantics.

## Package Identities

- Nx project: `governance-host-dbt`
- Python distribution: `anarchitecture-dbt-governance`
- Python module: `anarchitecture_dbt_governance`
- CLI command: `dbt-governance`
- Runtime package: `@anarchitects/governance-runtime-dbt`
- Pinned runtime version: `0.1.0`
- Runtime executable: `dbt-governance-runtime`
- Runtime version source:
  `packages/governance/host-dbt/src/anarchitecture_dbt_governance/runtime_manifest.json`
- Node range: `>=20 <25`
- Contract version: `1.0.0`

## High-Level Flow

```text
dbt-governance
  -> load governance.yml and CLI options
  -> resolve dbt project and artifact path hints
  -> use existing artifacts or optionally run dbt parse
  -> verify pinned runtime installation and compatibility
  -> invoke dbt-governance-runtime over stdin/stdout JSON
  -> preserve runtime result and diagnostics
  -> render host output and map final exit code
```

## Command Lifecycle

`dbt-governance check` and `dbt-governance report` follow this host-owned
lifecycle:

1. Load config from CLI flags, `governance.yml`, and host defaults.
2. Resolve dbt project and artifact path hints.
3. Ensure required artifacts exist, or run `dbt parse` when allowed.
4. Verify the pinned runtime package and executable.
5. Invoke `dbt-governance-runtime` over the process/JSON boundary.
6. Render human, JSON, or markdown output and optionally write reports.
7. Map the final exit code for local CLI and CI consumers.

## Boundary Ownership

| Layer                                    | Owns                                                                                                              | Does not own                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `governance-host-dbt`                    | CLI UX, config, dbt lifecycle decisions, pinned runtime setup, process invocation, rendering, reports, exit codes | governance semantics, dbt artifact normalization, runtime composition |
| `@anarchitects/governance-runtime-dbt`   | TypeScript composition boundary, runtime contracts, JSON process bridge                                           | dbt command execution, Python UX, final CI policy                     |
| `@anarchitects/governance-adapter-dbt`   | authoritative dbt detection, loading, validation, normalization, metadata preservation                            | dbt-specific interpretation, host orchestration                       |
| `@anarchitects/governance-extension-dbt` | dbt-specific interpretation, diagnostics, signals, metrics, recommendations                                       | dbt artifact loading, host orchestration                              |
| `@anarchitects/governance-core`          | canonical contracts and deterministic governance assessment                                                       | dbt-specific fields, host orchestration                               |

## Config Section Ownership

| Section     | Owned by                             | Used for                                     |
| ----------- | ------------------------------------ | -------------------------------------------- |
| `profile`   | canonical governance profile routing | profile document or profile file path        |
| `adapter`   | adapter/runtime boundary             | dbt path hints and adapter-owned options     |
| `extension` | extension/runtime boundary           | dbt extension-owned interpretation options   |
| `runtime`   | host runtime setup                   | cache directory and default report path      |
| `host`      | host only                            | artifact mode, output mode, CI exit behavior |

## Exit-Code Policy

| Exit code | Meaning                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `0`       | successful check with no blocking violations, or blocking violations allowed by `host.ci.failOnBlockingViolations=false` |
| `1`       | successful check with blocking violations when `host.ci.failOnBlockingViolations=true`                                   |
| `2`       | host, dbt, or runtime setup or invocation failure                                                                        |
| `3`       | unsupported or incompatible runtime or contract                                                                          |

## Runtime Handoff Notes

The host invokes `dbt-governance-runtime` as a machine-readable process
boundary.

- input goes to `stdin` as JSON
- output comes back on `stdout` as JSON
- `stderr` is preserved as diagnostic context
- non-zero runtime process exits preserve structured `stdout` JSON when it is
  valid
- non-zero process exits still remain host invocation failures unless the host
  detects incompatible runtime or contract metadata

The host never imports TypeScript runtime internals directly.

## E2E Strategy

The host e2e suite validates dbt-native host lifecycle and the process/JSON
boundary using fake executables. It does not constitute a full real-runtime
integration test.

Current strategy:

- fake `dbt`, `node`, `npm`, and `dbt-governance-runtime` executables
- copied fixtures
- no warehouse
- no secrets
- no dbt Cloud
- no network for the main e2e suite

This keeps host lifecycle coverage deterministic while avoiding accidental
ownership drift into adapter, extension, or runtime internals.

## Relationship To ADR 0003 And Contributor Guidance

Use these documents together:

- [ADR 0003](../adr/0003-governance-core-adapter-extension-host-boundaries.md)
  defines the ownership model.
- [Governance Boundary Contributor Guide](../governance-boundary-contributor-guide.md)
  gives the practical rules.
- [packages/governance/host-dbt/README.md](../../packages/governance/host-dbt/README.md)
  documents end-user and local-development behavior.
- [packages/governance/runtime-dbt/README.md](../../packages/governance/runtime-dbt/README.md)
  documents the runtime composition boundary.
- [packages/governance/adapter-dbt/README.md](../../packages/governance/adapter-dbt/README.md)
  documents adapter ownership.
