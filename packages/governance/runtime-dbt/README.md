# @anarchitects/governance-runtime-dbt

## Overview

`@anarchitects/governance-runtime-dbt` is the dbt Governance runtime
composition boundary for Node/npm consumers. It composes:

- `@anarchitects/governance-core`
- `@anarchitects/governance-adapter-dbt`
- `@anarchitects/governance-extension-dbt`

This package is the stable Node boundary for a future Python dbt Governance
Host. It is not the dbt-native Python host.

Package boundaries follow
[ADR 0001](../../../docs/adr/0001-governance-package-boundaries.md) and
[ADR 0003](../../../docs/adr/0003-governance-core-adapter-extension-host-boundaries.md).
Practical contributor guidance lives in
[`docs/governance-boundary-contributor-guide.md`](../../../docs/governance-boundary-contributor-guide.md).

## Runtime Responsibility

This package owns:

- composition of Core, the dbt adapter, and the dbt extension
- runtime input and result contracts
- routing of configuration to the correct ownership layer
- JSON in / JSON out process-boundary helpers for host integration

This package does not own:

- dbt command execution
- Python package setup
- dbt profiles or warehouse credentials
- local dbt project setup
- developer environment management
- human-facing CLI UX
- report rendering

## Non-Goals

The runtime does not run:

- `dbt build`
- `dbt parse`
- `dbt run`
- `dbt test`
- `dbt docs`
- `dbt source`

The runtime must not become the future dbt-native Python host. It is a library
boundary that a future host can call.

## Package Composition

- `@anarchitects/governance-core` owns canonical workspace, nodes, relations,
  diagnostics, capabilities, runtime references, assessment, and generic
  extension contracts.
- `@anarchitects/governance-adapter-dbt` owns dbt project detection, artifact
  loading, validation, normalization, and canonical workspace adapter output.
- `@anarchitects/governance-extension-dbt` owns dbt-specific interpretation,
  diagnostics, signals, rules, metrics, recommendations, and dbt-owned model
  expansion semantics.
- `@anarchitects/governance-runtime-dbt` composes those packages into one
  stable runtime boundary.
- A future Python dbt Governance Host will own dbt-native UX, dbt artifact
  lifecycle orchestration, environment setup, and CI ergonomics.

## Configuration Layering

The runtime keeps configuration separated into four top-level sections:

- `profile`: canonical Governance profile config only
- `adapter`: dbt adapter paths and adapter-owned options
- `extension`: dbt extension options only
- `runtime`: invocation context such as request id, working directory, and
  host-supplied metadata

Do not collapse adapter config, extension config, and canonical policy into
one profile object. That ownership boundary comes from ADR 0003.

Conceptual shape:

```ts
import type { DbtGovernanceRuntimeInput } from '@anarchitects/governance-runtime-dbt';

const input: DbtGovernanceRuntimeInput = {
  profile: {
    document: {
      name: 'dbt',
      layers: ['staging', 'intermediate', 'marts'],
    },
  },
  adapter: {
    paths: {
      projectDir: '/repo/analytics',
      manifestPath: '/repo/analytics/target/manifest.json',
    },
    options: {
      validationMode: 'strict',
    },
  },
  extension: {
    options: {
      createdAt: '2026-06-14T12:00:00.000Z',
    },
  },
  runtime: {
    requestId: 'req-123',
    workingDirectory: '/repo',
    dryRun: true,
  },
};
```

## TypeScript Usage

```ts
import {
  runDbtGovernanceRuntime,
  type DbtGovernanceRuntimeInput,
} from '@anarchitects/governance-runtime-dbt';

const input: DbtGovernanceRuntimeInput = {
  adapter: {
    paths: {
      projectDir: '/repo/analytics',
    },
  },
  runtime: {
    workingDirectory: '/repo',
    requestId: 'req-123',
  },
};

const result = await runDbtGovernanceRuntime(input);

if (!result.ok) {
  console.error(result.error.code);
} else {
  console.log(result.workspace?.id);
  console.log(result.assessment?.health.status);
}
```

On success, the runtime may return:

- canonical `workspace`
- adapter `diagnostics`
- extension diagnostics and registration diagnostics
- extension-produced `violations`, `signals`, `measurements`, and
  recommendations through the assembled `assessment`
- runtime `metadata` including package identity

## JSON Process Boundary

If a host needs a string-based process boundary, use
`runDbtGovernanceRuntimeFromJson(...)`.

```ts
import { runDbtGovernanceRuntimeFromJson } from '@anarchitects/governance-runtime-dbt';

const outputJson = await runDbtGovernanceRuntimeFromJson(
  JSON.stringify({
    adapter: {
      paths: {
        projectDir: './analytics',
      },
    },
    runtime: {
      workingDirectory: '/repo',
      requestId: 'req-json-1',
    },
  }),
);
```

Example JSON input:

```json
{
  "profile": {
    "document": {
      "name": "dbt"
    }
  },
  "adapter": {
    "paths": {
      "projectDir": "./analytics",
      "manifestPath": "./analytics/target/manifest.json"
    },
    "options": {
      "validationMode": "strict"
    }
  },
  "extension": {
    "options": {
      "createdAt": "2026-06-14T12:00:00.000Z"
    }
  },
  "runtime": {
    "requestId": "req-json-1",
    "workingDirectory": "/repo"
  }
}
```

Example JSON result shape:

```json
{
  "ok": true,
  "runtime": {
    "id": "governance-runtime:dbt",
    "packageName": "@anarchitects/governance-runtime-dbt"
  },
  "workspace": {
    "id": "dbt:analytics",
    "name": "analytics"
  },
  "assessment": {
    "profile": "dbt"
  },
  "metadata": {
    "runtime": {
      "packageName": "@anarchitects/governance-runtime-dbt",
      "id": "governance-runtime:dbt",
      "version": "0.0.1",
      "adapterPackageName": "@anarchitects/governance-adapter-dbt",
      "extensionPackageName": "@anarchitects/governance-extension-dbt",
      "generatedAt": "2026-06-14T12:00:00.000Z"
    }
  }
}
```

Structured JSON errors stay aligned with the runtime error contract and are
returned as normal JSON results instead of human-oriented stdout text.

## Relationship To The Future Python Host

The future Python dbt Governance Host should call this runtime as a stable
Node/npm composition layer. That host will own:

- dbt-native UX
- dbt artifact lifecycle orchestration
- environment setup
- CI ergonomics
- Python package setup
- dbt profiles and warehouse credentials

Those concerns must not move into this runtime package.

## Boundary Rules

- Keep canonical policy in `profile`.
- Keep dbt adapter paths and adapter options in `adapter`.
- Keep dbt extension interpretation options in `extension`.
- Keep invocation-only metadata in `runtime`.
- Do not import adapter or extension private paths.
- Do not add host, plugin, Nx runtime, or dbt command concerns here.
- Do not reintroduce legacy `projects` / `dependencies` terminology in runtime
  APIs. The canonical workspace boundary is `nodes` and `relations`.

## Public API

Common exports include:

- `runDbtGovernanceRuntime(...)`
- `runDbtGovernanceRuntimeFromJson(...)`
- `DbtGovernanceRuntimeInput`
- `DbtGovernanceRuntimeResult`
- `DbtGovernanceRuntimeSuccessResult`
- `DbtGovernanceRuntimeErrorResult`
- `DbtGovernanceRuntimeError`
- `DBT_GOVERNANCE_RUNTIME_PACKAGE_NAME`
- `DBT_GOVERNANCE_RUNTIME_ID`
- `DBT_GOVERNANCE_RUNTIME_VERSION`

## Related Packages And ADRs

- `@anarchitects/governance-core`
- `@anarchitects/governance-adapter-dbt`
- `@anarchitects/governance-extension-dbt`
- [ADR 0001](../../../docs/adr/0001-governance-package-boundaries.md)
- [ADR 0003](../../../docs/adr/0003-governance-core-adapter-extension-host-boundaries.md)
- [`docs/governance-boundary-contributor-guide.md`](../../../docs/governance-boundary-contributor-guide.md)

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository
[LICENSE](../../../LICENSE) and [NOTICE](../../../NOTICE) files.
