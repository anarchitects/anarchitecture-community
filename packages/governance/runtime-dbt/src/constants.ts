import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const runtimePackageJson = require('../package.json') as {
  version: string;
};

export const DBT_GOVERNANCE_RUNTIME_PACKAGE_NAME =
  '@anarchitects/governance-runtime-dbt' as const;
export const DBT_GOVERNANCE_RUNTIME_ID = 'governance-runtime:dbt' as const;
export const DBT_GOVERNANCE_RUNTIME_VERSION = runtimePackageJson.version;
export const DBT_GOVERNANCE_ADAPTER_PACKAGE_NAME =
  '@anarchitects/governance-adapter-dbt' as const;
export const DBT_GOVERNANCE_EXTENSION_PACKAGE_NAME =
  '@anarchitects/governance-extension-dbt' as const;

export const dbtGovernanceRuntimeMetadata = {
  id: DBT_GOVERNANCE_RUNTIME_ID,
  name: 'dbt Governance Runtime',
  packageName: DBT_GOVERNANCE_RUNTIME_PACKAGE_NAME,
  version: DBT_GOVERNANCE_RUNTIME_VERSION,
  adapterPackageName: DBT_GOVERNANCE_ADAPTER_PACKAGE_NAME,
  extensionPackageName: DBT_GOVERNANCE_EXTENSION_PACKAGE_NAME,
  description: 'dbt Governance runtime composition boundary.',
} as const;

export type DbtGovernanceRuntimeMetadata = typeof dbtGovernanceRuntimeMetadata;
