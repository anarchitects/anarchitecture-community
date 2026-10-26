import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Build the README's actual extracted recipes, with only bootstrap/server plumbing. */
export async function prepareReadmeSsr({ root, report, tsconfig, profile }) {
  for (const directory of ['src', 'public', 'examples'])
    await cp(join(root, '..', directory), join(root, directory), {
      recursive: true,
    });
  const write = (file, content) => writeFile(join(root, file), content);
  await write(
    'examples/shell.ts',
    `
    import { Component } from '@angular/core';
    import { RouterLink, RouterOutlet } from '@angular/router';
    @Component({ selector: 'aa-root', imports: [RouterLink, RouterOutlet],
      template: '<nav><a routerLink="/">Public</a><a routerLink="/edit">Edit</a><a routerLink="/form">Form</a></nav><router-outlet />' })
    export class Shell {}
  `,
  );
  await write(
    'tsconfig.readme.json',
    JSON.stringify(
      {
        ...tsconfig,
        compilerOptions: { ...tsconfig.compilerOptions, types: ['node'] },
        include: [],
        exclude: [],
        files: ['examples/main.ts', 'examples/main.server.ts', 'src/server.ts'],
      },
      null,
      2,
    ),
  );
  await write(
    'angular.json',
    JSON.stringify(
      {
        version: 1,
        cli: { analytics: false, cache: { enabled: false } },
        projects: {
          consumer: {
            projectType: 'application',
            root: '',
            sourceRoot: 'examples',
            architect: {
              build: {
                builder: '@angular/build:application',
                options: {
                  browser: 'examples/main.ts',
                  server: 'examples/main.server.ts',
                  ssr: { entry: 'src/server.ts' },
                  outputMode: 'server',
                  index: 'src/index.html',
                  tsConfig: 'tsconfig.readme.json',
                  outputPath: 'dist/readme',
                  styles: ['src/styles.css'],
                  assets: [{ glob: '**/*', input: 'public' }],
                  statsJson: true,
                  security: { allowedHosts: ['localhost', '127.0.0.1'] },
                },
              },
            },
          },
        },
      },
      null,
      2,
    ),
  );
  const full = profile === 'full';
  const evidence = join(report, 'readme', profile);
  await mkdir(evidence, { recursive: true });
  await write(
    'examples/main.ts',
    `
      import { bootstrapApplication } from '@angular/platform-browser';
      import { Shell } from './shell';
      import { articleConfig } from './article.config';
      bootstrapApplication(Shell, articleConfig(${full})).catch(console.error);
    `,
  );
  await write(
    'examples/main.server.ts',
    `
      import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
      import { Shell } from './shell';
      import { articleServerConfig } from './article.config.server';
      export default (context: BootstrapContext) => bootstrapApplication(Shell, articleServerConfig(${full}), context);
    `,
  );
  await cp(join(root, 'examples'), join(evidence, 'examples'), {
    recursive: true,
  });
  for (const file of ['angular.json', 'tsconfig.readme.json'])
    await cp(join(root, file), join(evidence, file));
}

export async function validateReadmeSsr({
  root,
  report,
  node,
  workspace,
  project,
  run,
  profile,
  port,
}) {
  const evidence = join(report, 'readme', profile);
  try {
    await run(
      node,
      [join(root, '..', 'node_modules/@angular/cli/bin/ng.js'), 'build'],
      root,
    );
    await run(
      process.execPath,
      [
        join(workspace, 'node_modules/@playwright/test/cli.js'),
        'test',
        '--config',
        join(project, 'playwright.readme.config.mts'),
      ],
      project,
      false,
      {
        EDITORJS_README_ROOT: root,
        EDITORJS_README_PORT: String(port),
        EDITORJS_README_NODE: node,
        EDITORJS_README_REPORT: evidence,
        EDITORJS_README_PROFILE: profile,
      },
    );
  } finally {
    await cp(join(root, 'dist/readme'), join(evidence, 'build'), {
      recursive: true,
    }).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
