import { createServer } from 'node:net';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Bind first, then retain a cross-invocation lease until all servers stop. */
export async function leasePorts(count) {
  const leases = [];
  const release = async () => {
    await Promise.all(
      leases.map(async ({ server, lock }) => {
        if (server.listening)
          await new Promise((resolve) => server.close(resolve));
        await rm(lock, { recursive: true, force: true });
      }),
    );
  };
  try {
    while (leases.length < count) {
      const server = createServer();
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const port = server.address().port;
      const lock = join(tmpdir(), `editorjs-packed-port-${port}`);
      try {
        await mkdir(lock);
      } catch (error) {
        await new Promise((resolve) => server.close(resolve));
        if (error.code === 'EEXIST') continue;
        throw error;
      }
      leases.push({ server, lock, port });
    }
    return {
      ports: leases.map(({ port }) => port),
      // Playwright needs known URLs before launching its servers. Other packed
      // runs honor the leases; unrelated occupation fails startup, never reuses it.
      async handoff() {
        await Promise.all(
          leases.map(
            ({ server }) => new Promise((resolve) => server.close(resolve)),
          ),
        );
      },
      release,
    };
  } catch (error) {
    await release();
    throw error;
  }
}
