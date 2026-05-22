import { fileURLToPath } from 'node:url';

import type { GovernanceWorkspaceAdapter } from '@anarchitects/governance-core';

import { runAgovCheck } from './check.js';

describe('Governance CLI adapter dependency boundary', () => {
  it('runs with an injected in-memory adapter implementing Core-owned contracts', () => {
    const workspaceAdapter: GovernanceWorkspaceAdapter<{
      workspaceName: string;
    }> = {
      id: 'test:memory-workspace',
      loadWorkspace(input) {
        return {
          workspaceId: input.workspaceName,
          workspaceName: input.workspaceName,
          workspaceRoot: '.',
          projects: [
            {
              id: 'customer-domain',
              name: 'customer-domain',
              root: 'src/customer/domain',
              type: 'library',
              domain: 'customer',
              layer: 'domain',
              tags: ['scope:customer', 'layer:domain', 'type:library'],
              metadata: {},
            },
          ],
          dependencies: [],
        };
      },
    };

    const result = runAgovCheck({
      profilePath: fileURLToPath(
        new URL(
          '../tests/fixtures/standalone-cli/passing-profile.json',
          import.meta.url,
        ),
      ),
      workspaceAdapter,
      workspaceAdapterInput: {
        workspaceName: 'memory-demo',
      },
    });

    expect(result.success).toBe(true);
    expect(result.assessment.workspace.name).toBe('memory-demo');
  });
});
