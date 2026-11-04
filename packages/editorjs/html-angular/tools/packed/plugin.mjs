import { matrix, phases, target } from './artifacts.mjs';
const root = 'packages/editorjs/html-angular';
const tools = `${root}/tools/packed`;
export const createNodesV2 = [
  `${root}/project.json`,
  async (files) => {
    const targets = {
      'packed-prepare': {
        executor: 'nx:noop',
        cache: false,
        dependsOn: Object.keys(matrix).map((cell) => target(cell, 'prepare')),
      },
    };
    for (const cell of Object.keys(matrix)) {
      targets[target(cell, 'prepare')] = {
        executor: 'nx:run-commands',
        cache: false,
        dependsOn: [
          'build',
          'packed-harness-test',
          ...(matrix[cell].angular
            ? [{ projects: ['editorjs-angular'], target: 'build' }]
            : []),
        ],
        options: { command: `node ${tools}/run.mjs prepare ${cell}` },
      };
      for (const phase of phases(cell)) {
        targets[target(cell, phase)] = {
          executor: 'nx:run-commands',
          cache: true,
          inputs: [
            'default',
            '^default',
            '{workspaceRoot}/yarn.lock',
            '{workspaceRoot}/nx.json',
            { env: 'EDITORJS_RENDERER_RUN_ID' },
            { env: 'NODE_OPTIONS' },
            { env: 'CI' },
            { env: 'PLAYWRIGHT_BROWSERS_PATH' },
            { env: 'NG_BUILD_MAX_WORKERS' },
            { runtime: `node ${tools}/run.mjs hash ${cell}` },
          ],
          dependsOn:
            matrix[cell].angular && phase !== 'build'
              ? [{ target: target(cell, 'build'), params: 'forward' }]
              : [],
          outputs: [
            `{workspaceRoot}/dist/editorjs-renderer-results/{options.runId}/${cell}/${phase}`,
          ],
          options: {
            command: `node ${tools}/run.mjs ${phase} ${cell} {args.runId}`,
            runId: 'missing',
          },
        };
      }
    }
    return files.map((file) => [file, { projects: { [root]: { targets } } }]);
  },
];
