import { mkdir, cp, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

/** Each tarball gets a separate external install with only its declared prerequisites. */
export async function prepareIndependentTools({
  parent,
  archives,
  versions,
  node,
  report,
  run,
}) {
  await mkdir(parent);
  for (const tool of ['paragraph', 'header', 'list', 'quote', 'image']) {
    const name = `@anarchitects/editorjs-tool-${tool}`;
    const root = join(parent, `independent-${tool}`);
    await mkdir(root);
    const dependencies = { '@editorjs/editorjs': versions.editorjs };
    for (const pkg of [name, '@anarchitects/editorjs-core']) {
      const archive = archives[pkg];
      await cp(archive, join(root, basename(archive)));
      dependencies[pkg] = `file:${basename(archive)}`;
    }
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ private: true, type: 'module', dependencies }),
    );
    await run('npm', ['install', '--no-audit', '--no-fund'], root);
    const evidence = await run(
      node,
      [
        '--input-type=module',
        '-e',
        `
      import assert from 'node:assert/strict';
      import {readFile} from 'node:fs/promises';
      const name=${JSON.stringify(name)};
      const manifest=JSON.parse(await readFile('node_modules/'+name+'/package.json','utf8'));
      for(const other of ['paragraph','header','list','quote','image']) {
        if(other!==${JSON.stringify(tool)})assert.throws(()=>import.meta.resolve('@anarchitects/editorjs-tool-'+other),{code:'ERR_MODULE_NOT_FOUND'});
      }
      for(const pkg of ['@angular/core','@angular/forms','@anarchitects/editorjs-angular'])assert.throws(()=>import.meta.resolve(pkg),{code:'ERR_MODULE_NOT_FOUND'});
      const versions={node:process.version};
      for(const [pkg,wanted] of Object.entries({...manifest.dependencies,...manifest.peerDependencies})) {
        const installed=JSON.parse(await readFile('node_modules/'+pkg+'/package.json','utf8'));
        versions[pkg]=installed.version;
        if(pkg.startsWith('@editorjs/'))assert.equal(installed.version,wanted);
      }
      const root=await import(name);
      assert.equal(typeof root['define'+${JSON.stringify(tool[0].toUpperCase() + tool.slice(1))}+'Tool'],'function');
      assert.equal(typeof root['validate'+${JSON.stringify(tool[0].toUpperCase() + tool.slice(1))}+'Data'],'function');
      assert(import.meta.resolve(name+'/browser').endsWith('/dist/browser.js'));
      assert.equal(globalThis.window,undefined);
      console.log(JSON.stringify({name,versions,exports:Object.keys(root),browser:manifest.exports['./browser']}));
    `,
      ],
      root,
      true,
    );
    await writeFile(join(report, `independent-${tool}.json`), evidence);
    await cp(
      join(root, 'package-lock.json'),
      join(report, `independent-${tool}-package-lock.json`),
    );
  }
}
