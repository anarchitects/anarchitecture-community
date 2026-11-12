import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyConsumers } from './consumer.mjs';

test('archive audit rejects bad metadata, paths and missing exports; clean install does not execute hooks', () => {
  const directory = mkdtempSync(join(tmpdir(), 'release-archive-test-'));
  const script = fileURLToPath(new URL('./audit.py', import.meta.url));
  const previous = process.env.NPM_CONFIG_OFFLINE;
  process.env.NPM_CONFIG_OFFLINE = 'true';
  try {
    mkdirSync(join(directory, 'sample'));
    execFileSync(
      'python3',
      [
        '-c',
        `
import io,json,tarfile,zipfile,sys
from pathlib import Path
p=Path(sys.argv[1])
base={'name':'release-fixture','version':'0.0.1','main':'./index.js','exports':{'.':'./index.js'},'scripts':{'install':'exit 91'}}
def archive(name,manifest,extra={}):
 files={'package/package.json':json.dumps(manifest),'package/README.md':'Documentation','package/LICENSE':'MIT','package/index.js':'module.exports=1',**extra}
 with tarfile.open(p/name,'w:gz') as a:
  for path,text in files.items():
   b=text.encode(); e=tarfile.TarInfo(path);e.size=len(b);a.addfile(e,io.BytesIO(b))
archive('sample/sample.tgz',base)
archive('missing.tgz',{**base,'exports':{'.':'./missing.js'}})
archive('metadata.tgz',{**base,'dependencies':{'bad':'workspace:*'}})
archive('path.tgz',base,{'../outside':'bad'})
with zipfile.ZipFile(p/'duplicate.whl','w') as a:
 a.writestr('same','a');a.writestr('same','b')
`,
        directory,
      ],
      { stdio: 'pipe' },
    );
    const audit = (name) =>
      JSON.parse(
        execFileSync('python3', [script, join(directory, name)], {
          encoding: 'utf8',
          stdio: 'pipe',
        }),
      );
    const result = audit('sample/sample.tgz');
    for (const name of [
      'missing.tgz',
      'metadata.tgz',
      'path.tgz',
      'duplicate.whl',
    ])
      assert.throws(() => audit(name), /ValueError/);
    const evidence = verifyConsumers(
      [
        {
          project: 'sample',
          name: 'release-fixture',
          channel: 'npm',
          dependencies: [],
          files: [{ name: 'sample.tgz', inventory: result.inventory }],
        },
      ],
      directory,
    );
    assert.equal(evidence.length, 1);
    assert.match(evidence[0].sha256, /^[a-f0-9]{64}$/);
    assert.equal(
      JSON.parse(readFileSync(join(directory, evidence[0].path), 'utf8'))
        .packages['node_modules/release-fixture'].version,
      '0.0.1',
    );
  } finally {
    if (previous === undefined) delete process.env.NPM_CONFIG_OFFLINE;
    else process.env.NPM_CONFIG_OFFLINE = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
