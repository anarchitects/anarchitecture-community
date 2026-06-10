import { fileURLToPath } from 'node:url';

import type { GovernanceWorkspaceAdapter } from '@anarchitects/governance-core';

import { runAgovCheck } from './check.js';

describe('Governance CLI adapter dependency boundary', () => {
  it('runs with an injected in-memory adapter implementing Core-owned contracts', async () => {
    const workspaceAdapter: GovernanceWorkspaceAdapter<{
      workspaceName: string;
    }> = {
      id: 'test:memory-workspace',
      loadWorkspace(input) {
        return {
          workspaceId: input.workspaceName,
          workspaceName: input.workspaceName,
          workspaceRoot: '.',
          nodes: [
            {
              id: 'customer-domain',
              name: 'customer-domain',
              kind: 'library',
              root: 'src/customer/domain',
              path: 'src/customer/domain',
              tags: ['scope:customer', 'layer:domain', 'type:library'],
              classification: {
                domain: 'customer',
                layer: 'domain',
              },
              metadata: {},
            },
          ],
          relations: [],
        };
      },
    };

    const result = await runAgovCheck({
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
