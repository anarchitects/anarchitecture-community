import { readFileSync } from 'node:fs';

import * as runtimeDbt from './index.js';
import type {
  DbtGovernanceRuntimeErrorResult,
  DbtGovernanceRuntimeInput,
  DbtGovernanceRuntimeSuccessResult,
} from './index.js';

const runtimePackageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
  version: string;
};

describe('dbt runtime public API', () => {
  it('exports the runtime boundary metadata from the package root', () => {
    expect(runtimeDbt.DBT_GOVERNANCE_RUNTIME_ID).toBe('governance-runtime:dbt');
    expect(runtimeDbt.DBT_GOVERNANCE_RUNTIME_PACKAGE_NAME).toBe(
      '@anarchitects/governance-runtime-dbt',
    );
    expect(runtimeDbt.DBT_GOVERNANCE_RUNTIME_VERSION).toBe(
      runtimePackageJson.version,
    );
    expect(runtimeDbt.DBT_GOVERNANCE_ADAPTER_PACKAGE_NAME).toBe(
      '@anarchitects/governance-adapter-dbt',
    );
    expect(runtimeDbt.DBT_GOVERNANCE_EXTENSION_PACKAGE_NAME).toBe(
      '@anarchitects/governance-extension-dbt',
    );
    expect(runtimeDbt.dbtGovernanceRuntimeMetadata).toEqual({
      id: 'governance-runtime:dbt',
      name: 'dbt Governance Runtime',
      packageName: '@anarchitects/governance-runtime-dbt',
      version: runtimePackageJson.version,
      adapterPackageName: '@anarchitects/governance-adapter-dbt',
      extensionPackageName: '@anarchitects/governance-extension-dbt',
      description: 'dbt Governance runtime composition boundary.',
    });
  });

  it('supports separated runtime input and output contracts', () => {
    const input: DbtGovernanceRuntimeInput = {
      profile: {
        path: './governance.profile.json',
        format: 'json',
      },
      adapter: {
        paths: {
          projectDir: './analytics',
          manifestPath: './analytics/target/manifest.json',
        },
        options: {
          validationMode: 'strict',
        },
      },
      extension: {
        options: {
          signals: {
            enabled: true,
          },
        },
      },
      runtime: {
        requestId: 'req-1',
        dryRun: true,
      },
    };

    const success: DbtGovernanceRuntimeSuccessResult = {
      ok: true,
      runtime: runtimeDbt.dbtGovernanceRuntimeMetadata,
      diagnostics: [],
      capabilities: [],
    };

    const failure: DbtGovernanceRuntimeErrorResult = {
      ok: false,
      runtime: runtimeDbt.dbtGovernanceRuntimeMetadata,
      diagnostics: [],
      capabilities: [],
      error: {
        code: 'governance.runtime.invalid_input',
        stage: 'input',
        message: 'Runtime input is invalid.',
      },
    };

    expect(input.adapter.paths.projectDir).toBe('./analytics');
    expect(success.ok).toBe(true);
    expect(failure.error.stage).toBe('input');
  });

  it('exports the runtime entrypoint from the package root', () => {
    expect(typeof runtimeDbt.runDbtGovernanceRuntime).toBe('function');
    expect(typeof runtimeDbt.runDbtGovernanceRuntimeFromJson).toBe('function');
  });

  it('keeps the runtime package bin boundary separate from the public TypeScript API', () => {
    expect('runDbtGovernanceRuntimeExecutable' in runtimeDbt).toBe(false);
  });
});
