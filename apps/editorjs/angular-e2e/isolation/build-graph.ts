import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { buildDirectory, packed } from '../tools/ssr-environment.mjs';

interface Output {
  entryPoint?: string;
  inputs: Record<string, { bytesInOutput: number }>;
  imports: { path: string; kind: string; external?: boolean }[];
}
interface Metadata {
  outputs: Record<string, Output>;
}

/** Output membership comes from emitted browser files, provenance from builder metadata. */
export async function buildGraph(eager = false) {
  const directory = buildDirectory(eager ? '-eager' : '');
  const metadata: Metadata = JSON.parse(
    await readFile(join(directory, 'stats.json'), 'utf8'),
  );
  const files = new Set(
    await readdir(join(directory, 'browser'), { recursive: true }),
  );
  const outputs = Object.fromEntries(
    Object.entries(metadata.outputs).filter(([name]) => files.has(name)),
  );
  const emittedFrom = (source: string) =>
    Object.entries(outputs)
      .filter(([, output]) => output.entryPoint === source)
      .map(([name]) => name);
  const main = emittedFrom(
    `apps/editorjs/angular-host/src/${eager ? 'isolation/main.eager' : 'ssr/main'}.ts`,
  );
  const publicPage = emittedFrom(
    'apps/editorjs/angular-host/src/ssr/public-page.ts',
  );
  const runtime = Object.entries(outputs)
    .filter(([, output]) =>
      Object.entries(output.inputs).some(
        ([input, contribution]) =>
          /(?:^|\/)node_modules\/@editorjs\/editorjs\//.test(input) &&
          contribution.bytesInOutput > 0,
      ),
    )
    .map(([name]) => name);
  assert.equal(main.length, 1, 'Expected one production browser entry');
  assert.equal(publicPage.length, 1, 'Expected the lazy public route entry');
  assert(
    runtime.length > 0,
    'Editor.js must be present in output as a positive control',
  );

  function closure(roots: string[], includeDynamic = false): string[] {
    const seen = new Set<string>();
    function visit(name: string) {
      if (seen.has(name)) return;
      const output = outputs[name];
      assert(output, `Missing browser output metadata: ${name}`);
      seen.add(name);
      for (const edge of output.imports) {
        if (!includeDynamic && edge.kind === 'dynamic-import') continue;
        assert(
          !edge.external,
          `Unclassified external browser dependency: ${edge.path}`,
        );
        const target = outputs[edge.path]
          ? edge.path
          : posix.join(posix.dirname(name), edge.path);
        visit(target);
      }
    }
    roots.forEach(visit);
    return [...seen].sort();
  }
  const tools = Object.fromEntries(
    ['card', 'marker', 'flag', 'unselected'].map((tool) => [
      tool,
      Object.entries(outputs)
        .filter(([, output]) =>
          Object.entries(output.inputs).some(
            ([input, value]) =>
              input.endsWith(`/registry/tools/${tool}.ts`) &&
              value.bytesInOutput > 0,
          ),
        )
        .map(([name]) => name),
    ]),
  );
  for (const tool of ['paragraph', 'header', 'list', 'quote', 'image']) {
    tools['common-' + tool] = Object.entries(outputs)
      .filter(([, output]) =>
        Object.entries(output.inputs).some(
          ([input, value]) =>
            input.includes('@editorjs/' + tool + '/dist/') &&
            value.bytesInOutput > 0,
        ),
      )
      .map(([file]) => file);
    assert(
      Object.values(outputs).some((output) =>
        Object.entries(output.inputs).some(
          ([input, value]) =>
            input.includes(
              packed
                ? '@anarchitects/editorjs-tool-' + tool + '/dist/browser.js'
                : 'packages/editorjs/tool-' + tool + '/dist/browser.js',
            ) && value.bytesInOutput > 0,
        ),
      ),
      'Missing browser entry provenance: ' + tool,
    );
  }
  tools['upload-backend'] = Object.entries(outputs)
    .filter(([, output]) =>
      Object.entries(output.inputs).some(
        ([input, value]) =>
          input.endsWith('/upload/backend.ts') && value.bytesInOutput > 0,
      ),
    )
    .map(([file]) => file);
  for (const [tool, files] of Object.entries(tools))
    assert(files.length > 0, `Missing tool output: ${tool}`);
  const initial = closure(main);
  const publicClosure = closure([...main, ...publicPage]);
  const all = closure(main, true);
  for (const asset of runtime)
    assert(all.includes(asset), `Unreachable runtime output: ${asset}`);
  const report = {
    directory,
    main,
    publicPage,
    runtime,
    tools,
    initial,
    publicClosure,
    outputs,
  };
  function assertIsolated(extraRoots: string[] = []) {
    const reached = closure([...main, ...publicPage, ...extraRoots]);
    const leaks = [...runtime, ...Object.values(tools).flat()].filter((asset) =>
      reached.includes(asset),
    );
    assert.deepEqual(
      leaks,
      [],
      `Editor.js runtime enters the public eager dependency closure: ${leaks.join(', ')}`,
    );
  }
  return { ...report, report, assertIsolated };
}
export type BuildGraph = Awaited<ReturnType<typeof buildGraph>>;
