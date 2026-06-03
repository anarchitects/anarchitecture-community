# @anarchitects/governance-adapter-dbt

## Purpose

`@anarchitects/governance-adapter-dbt` is the package boundary for dbt adapter
work in this monorepo. It exists to own dbt discovery, loading, validation,
normalization, and metadata preservation only.

This scaffold intentionally does not implement dbt artifact loading, dbt
project detection, dbt normalization logic, rules, metrics, scores,
diagnostics, recommendations, runtime composition, or Python host behavior.

## Location

- Package root: `packages/governance/adapter-dbt`
- Nx project name: `governance-adapter-dbt`
- npm package name: `@anarchitects/governance-adapter-dbt`

## Nx Commands

```bash
yarn nx show project governance-adapter-dbt
yarn nx build governance-adapter-dbt
yarn nx test governance-adapter-dbt
yarn nx lint governance-adapter-dbt
```

## Architectural Boundary

```text
Adapter = discovery, loading, validation, normalization, metadata preservation.
Extension = dbt-specific governance meaning.
Runtime = TypeScript composition boundary.
Host = dbt-native Python developer experience.
```

This package owns only the Adapter line. It must not depend on dbt extension,
runtime, or host packages.

## Non-Goals

- Implementing dbt artifact loading
- Implementing dbt project detection
- Implementing dbt normalization
- Implementing dbt rules, metrics, scores, diagnostics, or recommendations
- Adding dependencies on `@anarchitects/governance-extension-dbt`
- Adding dependencies on `@anarchitects/governance-runtime-dbt`
- Adding dependencies on `@anarchitects/governance-host-dbt`
- Implementing Python code
- Invoking dbt commands
- Adding npm runtime setup logic
