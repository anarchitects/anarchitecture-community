import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFetchFileUploader,
  createFetchUrlUploader,
  FetchUploadError,
  type FetchUploadOptions,
} from '../src/browser.js';
import {
  composeImageUploader,
  createUploadOperation,
} from '@anarchitects/editorjs-core';
const success = {
  success: 1 as const,
  file: {
    url: '/asset.svg',
    id: 'asset',
    nested: { widths: [10, 20], alt: '' },
  },
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const options = (
  fetcher: typeof fetch = vi.fn(async () => json(success)),
): FetchUploadOptions<string> => ({
  request: () => ({
    url: 'https://backend.test/upload',
    init: { method: 'POST' },
  }),
  decode: (body) => body as typeof success,
  fetch: fetcher,
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('request and mapping boundaries', () => {
  it('keeps service receivers, creates fresh multipart bodies and accepts an unnamed Blob', async () => {
    const bodies: FormData[] = [];
    const host = {
      field: 'photo',
      request(input: Blob) {
        const body = new FormData();
        body.append(this.field, input, 'fallback.svg');
        bodies.push(body);
        return {
          url: '/upload',
          init: {
            method: 'POST',
            body,
            credentials: 'include' as const,
            headers: { 'X-Host': 'yes' },
          },
        };
      },
      async fetch(_url: RequestInfo | URL, init?: RequestInit) {
        expect(this.field).toBe('photo');
        expect(init?.credentials).toBe('include');
        expect(new Headers(init?.headers).has('content-type')).toBe(false);
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        return json(success);
      },
      decode(body: unknown) {
        expect(this.field).toBe('photo');
        return body as typeof success;
      },
    };
    const uploader = createFetchFileUploader(host);
    const input = new Blob(['test'], { type: 'image/svg+xml' });
    expect('name' in input).toBe(false);
    const first = await uploader.uploadByFile(input);
    await uploader.uploadByFile(input);
    expect(first).toEqual(success);
    expect(first).not.toBe(success);
    expect(bodies[0]).not.toBe(bodies[1]);
    expect((bodies[0].get('photo') as File).name).toBe('fallback.svg');
    expect(await (bodies[0].get('photo') as Blob).text()).toBe('test');
    expect(uploader).not.toHaveProperty('uploadByUrl');
  });
  it('submits the input URL as data only to the configured endpoint', async () => {
    const fetcher = vi.fn(async () => json(success));
    const config = options(fetcher);
    config.request = (url) => ({
      url: '/host',
      init: { method: 'POST', body: JSON.stringify({ source: url }) },
    });
    const uploader = createFetchUrlUploader(config);
    await uploader.uploadByUrl('https://untrusted.test/image');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]).toMatchObject([
      '/host',
      { body: '{"source":"https://untrusted.test/image"}' },
    ]);
    expect(uploader).not.toHaveProperty('uploadByFile');
  });
  it('resolves native fetch at invocation, never during construction', async () => {
    const config = options();
    delete config.fetch;
    vi.stubGlobal('fetch', undefined);
    const uploader = createFetchUrlUploader(config);
    await expect(uploader.uploadByUrl('x')).rejects.toMatchObject({
      code: 'unsupported',
    });
    const native = vi.fn(async function (this: unknown) {
      expect(this).toBe(globalThis);
      return json(success);
    });
    vi.stubGlobal('fetch', native);
    await expect(uploader.uploadByUrl('x')).resolves.toEqual(success);
  });
  it.each([401, 403, 404, 429, 500])(
    'rejects HTTP %i without consuming or exposing its body',
    async (status) => {
      const response = json({ secret: 'password' }, status);
      const read = vi.spyOn(response, 'json');
      const uploader = createFetchUrlUploader(options(async () => response));
      await expect(uploader.uploadByUrl('x')).rejects.toMatchObject({
        code: 'http',
        status,
        message: 'Upload http failure.',
      });
      expect(read).not.toHaveBeenCalled();
    },
  );
  it('explicitly maps denied HTTP JSON into a host failure, preserving host error identity', async () => {
    const error = { code: 'denied' };
    const config = options(async () => json({ denied: true }, 403));
    config.decodeHttpErrors = true;
    config.decode = (body, context) => {
      expect(body).toEqual({ denied: true });
      expect(context.status).toBe(403);
      expect(context.ok).toBe(false);
      expect(Object.isFrozen(context)).toBe(true);
      return { success: 0, error };
    };
    const result = await createFetchUrlUploader(config).uploadByUrl('x');
    expect(result).toEqual({ success: 0, error });
    if (!result.success) expect(result.error).toBe(error);
    config.decode = () => success;
    await expect(
      createFetchUrlUploader(config).uploadByUrl('x'),
    ).rejects.toMatchObject({ code: 'mapping', status: 403 });
  });
  it('separates network, malformed JSON and mapping exceptions with safe messages', async () => {
    const cause = new Error('secret endpoint');
    await expect(
      createFetchUrlUploader(
        options(async () => {
          throw cause;
        }),
      ).uploadByUrl('x'),
    ).rejects.toMatchObject({
      code: 'network',
      cause,
      message: 'Upload network failure.',
    });
    await expect(
      createFetchUrlUploader(
        options(async () => new Response('{')),
      ).uploadByUrl('x'),
    ).rejects.toMatchObject({ code: 'response' });
    const config = options();
    config.decode = () => {
      throw cause;
    };
    await expect(
      createFetchUrlUploader(config).uploadByUrl('x'),
    ).rejects.toMatchObject({ code: 'mapping', cause });
  });
  it.each([
    null,
    {},
    { success: true },
    { success: 0, file: {} },
    { success: 1, file: {} },
    { success: 1, file: { url: ' ' } },
    { success: 1, file: { url: 7 } },
    { success: 1, file: [] },
    { success: 1, file: { url: 'x' }, error: undefined },
  ])('rejects malformed mapped result %j', async (value) => {
    const config = options();
    config.decode = () => value as typeof success;
    await expect(
      createFetchUrlUploader(config).uploadByUrl('x'),
    ).rejects.toMatchObject({ code: 'mapping' });
  });
  it.each([NaN, BigInt(1), () => 1, new Date(), undefined])(
    'rejects non-JSON metadata %s',
    async (bad) => {
      const config = options();
      config.decode = () => ({ success: 1, file: { url: 'x', bad } });
      await expect(
        createFetchUrlUploader(config).uploadByUrl('x'),
      ).rejects.toMatchObject({ code: 'mapping' });
    },
  );
  it('rejects cycles and metadata accessors without executing getters', async () => {
    const file: Record<string, unknown> = { url: 'x' };
    file['cycle'] = file;
    const config = options();
    config.decode = () => ({ success: 1, file: file as { url: string } });
    await expect(
      createFetchUrlUploader(config).uploadByUrl('x'),
    ).rejects.toMatchObject({ code: 'mapping' });
    delete file['cycle'];
    const getter = vi.fn(() => 'secret');
    Object.defineProperty(file, 'value', { get: getter, enumerable: true });
    await expect(
      createFetchUrlUploader(config).uploadByUrl('x'),
    ).rejects.toMatchObject({ code: 'mapping' });
    expect(getter).not.toHaveBeenCalled();
  });
  it('does not silently retry any failure and composes with the core ports', async () => {
    const fetcher = vi.fn(async () => json({}, 503));
    const files = createFetchFileUploader({
      ...options(fetcher),
      request: () => ({ url: '/upload' }),
    });
    const urls = createFetchUrlUploader(options(fetcher));
    const combined = composeImageUploader(files, urls);
    await expect(
      createUploadOperation(() => combined.uploadByUrl('x')).result,
    ).rejects.toMatchObject({ code: 'http' });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

describe('cancellation and lifetime', () => {
  it('does not send an already-cancelled request', async () => {
    const owner = new AbortController();
    owner.abort();
    const fetcher = vi.fn(async () => json(success));
    const config = options(fetcher);
    config.request = () => ({ url: '/upload', init: { signal: owner.signal } });
    await expect(
      createFetchUrlUploader(config).uploadByUrl('x'),
    ).rejects.toMatchObject({ code: 'cancelled' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('settles promptly for a transport ignoring abort, observes late rejection and isolates calls', async () => {
    const owner = new AbortController();
    const signals: AbortSignal[] = [];
    let fail!: (cause: unknown) => void;
    const config = options(async (_url, init) => {
      signals.push(requiredSignal(init));
      return signals.length === 1
        ? new Promise((_yes, no) => {
            fail = no;
          })
        : json(success);
    });
    config.request = (input) => ({
      url: '/upload',
      init: { signal: input === 'cancel' ? owner.signal : undefined },
    });
    const uploader = createFetchUrlUploader(config);
    const pending = uploader.uploadByUrl('cancel');
    const assertion = expect(pending).rejects.toMatchObject({
      code: 'cancelled',
    });
    await expect(uploader.uploadByUrl('other')).resolves.toEqual(success);
    owner.abort();
    await assertion;
    expect(signals[0].aborted).toBe(true);
    expect(signals[0]).not.toBe(signals[1]);
    fail(new Error('late'));
    await Promise.resolve();
  });
  it.each(['request', 'body', 'decoder'])(
    'bounds %s and cleans up timers/listeners',
    async (phase) => {
      vi.useFakeTimers();
      const owner = new AbortController();
      const remove = vi.spyOn(owner.signal, 'removeEventListener');
      let captured!: AbortSignal;
      const never = () => new Promise<never>(() => undefined);
      const config = options(async (_url, init) => {
        captured = requiredSignal(init);
        if (phase === 'request') return never();
        const response = json(success);
        if (phase === 'body')
          vi.spyOn(response, 'json').mockImplementation(never);
        return response;
      });
      if (phase === 'decoder') config.decode = never;
      config.request = () => ({
        url: '/upload',
        timeoutMs: 25,
        init: { signal: owner.signal },
      });
      const pending = createFetchUrlUploader(config).uploadByUrl('x');
      const assertion = expect(pending).rejects.toMatchObject({
        code: 'timeout',
      });
      await vi.advanceTimersByTimeAsync(25);
      await assertion;
      expect(captured.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
      expect(remove).toHaveBeenCalledOnce();
    },
  );
  it('removes timeout and abort listener on success; a later cancellation has no effect', async () => {
    vi.useFakeTimers();
    const owner = new AbortController();
    const remove = vi.spyOn(owner.signal, 'removeEventListener');
    const config = options();
    config.request = () => ({
      url: '/upload',
      timeoutMs: 100,
      init: { signal: owner.signal },
    });
    const result = await createFetchUrlUploader(config).uploadByUrl('x');
    owner.abort();
    expect(result).toEqual(success);
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledOnce();
  });
  it('logical core stop does not abort transport unless the host connects its signal', async () => {
    let signal!: AbortSignal;
    let finish!: (value: Response) => void;
    const config = options((_url, init) => {
      signal = requiredSignal(init);
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const uploader = createFetchUrlUploader(config);
    const operation = createUploadOperation(() => uploader.uploadByUrl('x'));
    const assertion = expect(operation.result).rejects.toMatchObject({
      code: 'stopped',
    });
    await Promise.resolve();
    operation.stop();
    await assertion;
    expect(signal.aborted).toBe(false);
    finish(json(success));
    await Promise.resolve();
  });
});

it.each([0, -1, 0.5, Infinity, 2_147_483_648])(
  'rejects invalid timeout %s before fetch',
  async (timeoutMs) => {
    const fetcher = vi.fn(async () => json(success));
    const config = options(fetcher);
    config.request = () => ({ url: '/upload', timeoutMs });
    await expect(
      createFetchUrlUploader(config).uploadByUrl('x'),
    ).rejects.toBeInstanceOf(TypeError);
    expect(fetcher).not.toHaveBeenCalled();
  },
);
it('fails explicit unsupported capabilities/configuration without inventing methods', async () => {
  expect(() =>
    createFetchUrlUploader({} as FetchUploadOptions<string>),
  ).toThrow(TypeError);
  const uploader = createFetchUrlUploader(options());
  await expect(uploader.uploadByUrl(' ')).rejects.toThrow(TypeError);
  expect(() => composeImageUploader(uploader as never, uploader)).toThrow(
    TypeError,
  );
  expect(new FetchUploadError('timeout')).toBeInstanceOf(Error);
});

function requiredSignal(init?: RequestInit): AbortSignal {
  if (!init?.signal) throw new Error('Missing request signal');
  return init.signal;
}

it('rejects Request instances instead of accidentally discarding their method/body', async () => {
  const fetcher = vi.fn(async () => json(success));
  const config = options(fetcher);
  config.request = () =>
    new Request('https://backend.test/upload', {
      method: 'POST',
      body: 'bytes',
    });
  await expect(createFetchUrlUploader(config).uploadByUrl('x')).rejects.toThrow(
    TypeError,
  );
  expect(fetcher).not.toHaveBeenCalled();
});

it('rejects and observes an accidentally async request builder', async () => {
  const config = options();
  config.request = (async () => {
    throw new Error('async builder');
  }) as unknown as typeof config.request;
  await expect(createFetchUrlUploader(config).uploadByUrl('x')).rejects.toThrow(
    'synchronous',
  );
  await Promise.resolve();
});
