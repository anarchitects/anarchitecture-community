# @anarchitects/governance-runtime-dbt

## Overview

`@anarchitects/governance-runtime-dbt` is the dbt Governance runtime
composition boundary.

It will compose Governance Core, the dbt adapter, and the dbt extension in
later issues.

It is not the dbt-native Python host.

It must not invoke dbt commands.

It must not own Python package setup, dbt CLI UX, or developer environment
management.

## Current Scope

This package currently defines the public runtime contract surface only. The
main exported contract names are:

- `DbtGovernanceRuntimeInput`
- `DbtGovernanceRuntimeResult`
- `DbtGovernanceRuntimeSuccessResult`
- `DbtGovernanceRuntimeErrorResult`
- `DbtGovernanceRuntimeError`
- `runDbtGovernanceRuntime(...)`

## License

Copyright © 2026 Optimalist BV and Anarchitects contributors.

Licensed under the Apache License, Version 2.0. See the repository
[LICENSE](../../../LICENSE) and [NOTICE](../../../NOTICE) files.
