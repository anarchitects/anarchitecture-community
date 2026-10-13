import { spawn } from 'node:child_process';
import { join } from 'node:path';

const child = spawn(
  process.env.EDITORJS_README_NODE,
  [join(process.env.EDITORJS_README_ROOT, 'dist/readme/server/server.mjs')],
  {
    cwd: process.env.EDITORJS_README_ROOT,
    env: { ...process.env, PORT: '4335' },
    stdio: 'inherit',
  },
);
child.once('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.once('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => child.kill('SIGTERM'));
