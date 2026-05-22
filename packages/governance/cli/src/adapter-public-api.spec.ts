import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { detectTypeScriptWorkspace } from '@anarchitects/governance-adapter-typescript';

describe('Governance CLI adapter dependency boundary', () => {
  it('touches the TypeScript adapter only through its public package API', () => {
    const packageRoot = fileURLToPath(new URL('..', import.meta.url));
    const result = detectTypeScriptWorkspace(packageRoot);

    expect(result.workspaceRoot).toBe(path.resolve(packageRoot));
    expect(result.status).toBe('partial');
  });
});
