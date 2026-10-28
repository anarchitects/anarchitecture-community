import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { packedPhases, phasesFor, targetFor } from './packed-phases.mjs';

const root = 'apps/editorjs/angular-e2e';
const tools = `${root}/tools`;
export const createNodesV2 = [
  `${root}/project.json`,
  async (files, _options, context) => {
    const matrix = JSON.parse(
      await readFile(
        join(context.workspaceRoot, tools, 'compatibility-matrix.json'),
        'utf8',
      ),
    );
    const targets = {};
    for (const mode of ['csr', 'ssr'])
      for (const cell of Object.keys(matrix)) {
        const prefix = targetFor(mode, cell, '');
        const inputs = [
          'default',
          '^production',
          '{workspaceRoot}/yarn.lock',
          '{workspaceRoot}/nx.json',
          '{workspaceRoot}/.nx/workflows/editorjs-packed.yaml',
          '{workspaceRoot}/packages/editorjs/angular/tests/fixtures/**/*',
          '{workspaceRoot}/packages/editorjs/angular/tests/forms-interop.spec.ts',
          { env: 'CI' },
          { env: 'EDITORJS_PACKED_RUN_ID' },
          { env: 'NG_BUILD_MAX_WORKERS' },
          { runtime: 'node --version' },
          { runtime: `node ${tools}/packed-input-hash.mjs ${mode} ${cell}` },
        ];
        targets[`${prefix}prepare`] = {
          executor: 'nx:run-commands',
          cache: false,
          parallelism: true,
          dependsOn: [
            {
              projects: [
                'editorjs-angular',
                'editorjs-tool-paragraph',
                'editorjs-tool-header',
                'editorjs-tool-list',
                'editorjs-tool-quote',
              ],
              target: 'build',
              params: 'ignore',
            },
          ],
          outputs: [
            `{workspaceRoot}/dist/editorjs-packed-inputs/{options.runId}/${mode}/${cell}`,
          ],
          options: {
            command: `node ${tools}/prepare-packed.mjs ${cell} ${mode} {args.runId}`,
            runId: 'missing',
          },
        };
        for (const phase of phasesFor(mode)) {
          const prerequisites = packedPhases[phase];
          targets[`${prefix}${phase}`] = {
            executor: 'nx:run-commands',
            cache: true,
            parallelism: true,
            inputs,
            outputs: [
              `{workspaceRoot}/dist/editorjs-packed-results/{options.runId}/${mode}/${cell}/${phase}`,
            ],
            dependsOn: prerequisites.map((phase) => ({
              target: `${prefix}${phase}`,
              params: 'forward',
            })),
            options: {
              command: `node ${tools}/packed-phase.mjs ${mode} ${cell} ${phase} {args.runId}`,
              runId: 'missing',
            },
            metadata: {
              description: `Record packed ${mode} ${cell} evidence: ${phase}`,
            },
          };
        }
      }
    return files.map((file) => [file, { projects: { [root]: { targets } } }]);
  },
];
export const createNodes = createNodesV2;
