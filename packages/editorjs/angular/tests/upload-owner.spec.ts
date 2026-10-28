import '@angular/compiler';
import {
  createEnvironmentInjector,
  DestroyRef,
  inject,
  InjectionToken,
  Injector,
  type EnvironmentInjector,
} from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  composeImageUploader,
  UploadStoppedError,
  type ImageUploader,
  type UploadResponse,
  type UploadRetryPolicy,
} from '@anarchitects/editorjs-core';
import {
  createEditorJsUploadOwner,
  type EditorJsUploadOwner,
} from '../src/index.js';

const environments: EnvironmentInjector[] = [];
function environment() {
  const value = createEnvironmentInjector(
    [],
    Injector.NULL as EnvironmentInjector,
  );
  environments.push(value);
  return value;
}
const options = () => ({ destroyRef: environment().get(DestroyRef) });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const success = {
  success: 1 as const,
  file: { url: '/safe', metadata: { id: 7 } },
};
const failure = { success: 0 as const, error: { token: 'private-token' } };
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
afterEach(() => {
  for (const env of environments.splice(0)) if (!env.destroyed) env.destroy();
});

describe('upload owner', () => {
  it('preserves capabilities, receivers, generic metadata and result identity', async () => {
    const files = {
      calls: 0,
      async uploadByFile(input: Uint8Array) {
        this.calls += input.length;
        return success;
      },
    };
    const urls = {
      calls: 0,
      async uploadByUrl(
        input: string,
      ): Promise<UploadResponse<typeof success.file, typeof failure.error>> {
        this.calls += input.length;
        return failure;
      },
    };
    const fileOwner = createEditorJsUploadOwner(files, options());
    const urlOwner = createEditorJsUploadOwner(urls, options());
    expect(Object.keys(fileOwner.uploader)).toEqual(['uploadByFile']);
    expect(Object.keys(urlOwner.uploader)).toEqual(['uploadByUrl']);
    const owner = createEditorJsUploadOwner(
      composeImageUploader(files, urls),
      options(),
    );
    const result = await owner.uploader.uploadByFile(new Uint8Array(2));
    expect(result).toBe(success);
    if (result.success) expect(result.file.metadata.id).toBe(7);
    expect(await owner.uploader.uploadByUrl('url')).toBe(failure);
    expect(files.calls).toBe(2);
    expect(urls.calls).toBe(3);
    expect(Object.isFrozen(owner.uploader)).toBe(true);
  });

  it('counts concurrent logical work and retains unrelated failures after out-of-order success', async () => {
    const first = deferred<UploadResponse>();
    const second = deferred<UploadResponse>();
    const owner = createEditorJsUploadOwner(
      {
        uploadByUrl: vi
          .fn()
          .mockReturnValueOnce(first.promise)
          .mockReturnValueOnce(second.promise),
      },
      options(),
    );
    const a = owner.uploader.uploadByUrl('secret-a');
    const b = owner.uploader.uploadByUrl('secret-b');
    expect(owner.activeCount()).toBe(2);
    expect(owner.busy()).toBe(true);
    const id = owner.operations()[0].id;
    owner.acknowledge(id);
    expect(owner.operations()).toHaveLength(2);
    second.resolve(failure);
    expect(await b).toBe(failure);
    expect(owner.activeCount()).toBe(1);
    first.resolve(success);
    await a;
    expect(owner.busy()).toBe(false);
    expect(owner.operations()).toHaveLength(1);
    expect(owner.hasErrors()).toBe(true);
    expect(JSON.stringify(owner.operations())).not.toMatch(
      /secret|private-token/,
    );
    expect(Object.isFrozen(owner.operations())).toBe(true);
    expect(Object.isFrozen(owner.operations()[0])).toBe(true);
    owner.acknowledge(owner.operations()[0].id);
    expect(owner.hasErrors()).toBe(false);
  });

  it('preserves thrown causes, differentiates expected failures and treats manual retries as new operations', async () => {
    const cause = new Error('private transport details');
    const uploadByUrl = vi
      .fn()
      .mockResolvedValueOnce(failure)
      .mockImplementationOnce(() => {
        throw cause;
      })
      .mockResolvedValueOnce(success);
    const mapError = vi.fn(() => 'Safe upload error');
    const owner = createEditorJsUploadOwner(
      { uploadByUrl },
      { ...options(), mapError },
    );
    await owner.uploader.uploadByUrl('first');
    await expect(owner.uploader.uploadByUrl('second')).rejects.toBe(cause);
    expect(owner.operations().map((item) => item.status)).toEqual([
      'failure',
      'exception',
    ]);
    expect(mapError.mock.calls).toHaveLength(2);
    const ids = owner.operations().map((item) => item.id);
    await owner.uploader.uploadByUrl('retry');
    expect(owner.operations().map((item) => item.id)).toEqual(ids);
    expect(
      owner.operations().every((item) => item.message === 'Safe upload error'),
    ).toBe(true);
    expect(uploadByUrl).toHaveBeenCalledTimes(3);
  });

  it.each([
    () => {
      throw new Error('mapper private');
    },
    () => Promise.reject('async mapper'),
    () => '',
    () => ({ raw: 'secret' }),
  ])(
    'uses safe text for a broken presentation mapper without changing the port outcome',
    async (mapError) => {
      const owner = createEditorJsUploadOwner(
        { uploadByUrl: async () => failure },
        { ...options(), mapError: mapError as () => string },
      );
      expect(await owner.uploader.uploadByUrl('private')).toBe(failure);
      expect(owner.operations()[0].message).toBe(
        'Upload failed. Please try again.',
      );
      await flush();
    },
  );

  it('counts core retry attempts without increasing activity during the delay', async () => {
    let resume!: () => void;
    const uploadByUrl = vi
      .fn()
      .mockResolvedValueOnce(failure)
      .mockResolvedValueOnce(success);
    const retry: UploadRetryPolicy = {
      maxAttempts: 2,
      replaySafe: true,
      shouldRetry: () => true,
      delayMs: 1,
      schedule: (next) => {
        resume = next;
        return () => undefined;
      },
    };
    const owner = createEditorJsUploadOwner(
      { uploadByUrl },
      { ...options(), retry },
    );
    const result = owner.uploader.uploadByUrl('private');
    await flush();
    expect(owner.activeCount()).toBe(1);
    expect(owner.operations()[0]).toMatchObject({
      attempts: 1,
      status: 'active',
    });
    expect(owner.hasErrors()).toBe(false);
    resume();
    expect(await result).toBe(success);
    expect(uploadByUrl).toHaveBeenCalledTimes(2);
    expect(owner.operations()).toEqual([]);
  });

  it('retains final retry failure and its attempt count', async () => {
    const owner = createEditorJsUploadOwner(
      { uploadByUrl: async () => failure },
      {
        ...options(),
        retry: {
          maxAttempts: 2,
          replaySafe: true,
          shouldRetry: () => true,
          delayMs: 0,
          schedule: (resume) => {
            resume();
            return () => undefined;
          },
        },
      },
    );
    expect(await owner.uploader.uploadByUrl('private')).toBe(failure);
    expect(owner.operations()[0]).toMatchObject({
      attempts: 2,
      status: 'failure',
    });
  });

  it('rejects invalid retry policy before transport without a stranded busy record', async () => {
    const uploadByUrl = vi.fn(async () => success);
    const owner = createEditorJsUploadOwner(
      { uploadByUrl },
      { ...options(), retry: { maxAttempts: 0 } as UploadRetryPolicy },
    );
    await expect(owner.uploader.uploadByUrl('private')).rejects.toBeInstanceOf(
      TypeError,
    );
    expect(uploadByUrl).not.toHaveBeenCalled();
    expect(owner.busy()).toBe(false);
    expect(owner.operations()).toEqual([]);
  });

  it.each(['success', 'failure', 'exception'] as const)(
    'ignores late %s after reset and permits new work in a new generation',
    async (outcome) => {
      const pending = deferred<UploadResponse>();
      const mapError = vi.fn(() => 'Failure');
      const uploadByUrl = vi
        .fn()
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValueOnce(success);
      const owner = createEditorJsUploadOwner(
        { uploadByUrl },
        { ...options(), mapError },
      );
      const old = owner.uploader.uploadByUrl('old');
      const stopped = expect(old).rejects.toBeInstanceOf(UploadStoppedError);
      await flush();
      owner.reset();
      await stopped;
      expect(owner.generation()).toBe(1);
      expect(await owner.uploader.uploadByUrl('new')).toBe(success);
      if (outcome === 'exception') pending.reject(new Error('late secret'));
      else pending.resolve(outcome === 'failure' ? failure : success);
      await flush();
      expect(owner.operations()).toEqual([]);
      expect(owner.activeCount()).toBe(0);
      expect(mapError).not.toHaveBeenCalled();
    },
  );

  it('disposes through DestroyRef, observes late rejection, and rejects new work permanently', async () => {
    const env = environment();
    const pending = deferred<UploadResponse>();
    const uploadByUrl = vi.fn(() => pending.promise);
    const owner = createEditorJsUploadOwner(
      { uploadByUrl },
      { destroyRef: env.get(DestroyRef) },
    );
    const result = owner.uploader.uploadByUrl('private');
    const stopped = expect(result).rejects.toBeInstanceOf(UploadStoppedError);
    await flush();
    env.destroy();
    await stopped;
    pending.reject('late');
    owner.reset();
    owner.dispose();
    await expect(owner.uploader.uploadByUrl('new')).rejects.toBeInstanceOf(
      UploadStoppedError,
    );
    expect(owner.disposed()).toBe(true);
    expect(uploadByUrl).toHaveBeenCalledTimes(1);
    await flush();
  });

  it('does not start work when destroyed before its first microtask, including already destroyed contexts', async () => {
    const env = environment();
    const uploadByUrl = vi.fn(async () => success);
    const ref = env.get(DestroyRef);
    const owner = createEditorJsUploadOwner(
      { uploadByUrl },
      { destroyRef: ref },
    );
    const result = owner.uploader.uploadByUrl('private');
    env.destroy();
    await expect(result).rejects.toBeInstanceOf(UploadStoppedError);
    const disposed = createEditorJsUploadOwner(
      { uploadByUrl },
      { destroyRef: ref },
    );
    await expect(
      disposed.uploader.uploadByUrl('private'),
    ).rejects.toBeInstanceOf(UploadStoppedError);
    expect(uploadByUrl).not.toHaveBeenCalled();
  });

  it('stops retry delays and clears every handle even when host cancellation throws', async () => {
    const cancel = vi.fn(() => {
      throw new Error('broken scheduler');
    });
    const uploadByUrl = vi.fn(async () => failure);
    const resumes: (() => void)[] = [];
    const owner = createEditorJsUploadOwner(
      { uploadByUrl },
      {
        ...options(),
        retry: {
          maxAttempts: 2,
          replaySafe: true,
          shouldRetry: () => true,
          delayMs: 0,
          schedule: (resume) => {
            resumes.push(resume);
            return cancel;
          },
        },
      },
    );
    const results = [
      owner.uploader.uploadByUrl('a'),
      owner.uploader.uploadByUrl('b'),
    ];
    const stopped = Promise.all(
      results.map((result) =>
        expect(result).rejects.toBeInstanceOf(UploadStoppedError),
      ),
    );
    await flush();
    expect(() => owner.dispose()).toThrow(AggregateError);
    await stopped;
    resumes.forEach((resume) => resume());
    await flush();
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(uploadByUrl).toHaveBeenCalledTimes(2);
    expect(owner.busy()).toBe(false);
  });

  it('bounds diagnostic history without silently clearing unacknowledged failures', async () => {
    const owner = createEditorJsUploadOwner(
      { uploadByUrl: async () => failure },
      options(),
    );
    for (let i = 0; i < 105; i++) await owner.uploader.uploadByUrl('private');
    expect(owner.operations()).toHaveLength(100);
    expect(owner.overflow()?.count).toBe(5);
    const summary = owner.overflow();
    for (const item of owner.operations()) owner.acknowledge(item.id);
    expect(owner.hasErrors()).toBe(true);
    owner.acknowledge(summary!.id);
    expect(owner.hasErrors()).toBe(false);
    await owner.uploader.uploadByUrl('new');
    owner.reset();
    expect(owner.overflow()).toBeUndefined();
    expect(owner.hasErrors()).toBe(false);
  });

  it.each(['reset', 'dispose'] as const)(
    'cannot revive state when the host mapper calls %s',
    async (method) => {
      const owner = createEditorJsUploadOwner(
        { uploadByUrl: async () => failure },
        {
          ...options(),
          mapError: () => {
            owner[method]();
            return 'old';
          },
        },
      );
      expect(await owner.uploader.uploadByUrl('private')).toBe(failure);
      expect(owner.operations()).toEqual([]);
      expect(owner.hasErrors()).toBe(false);
    },
  );

  it('uses independent DI lifetimes over a shared backend and owner-unique acknowledgement IDs', async () => {
    const BACKEND = new InjectionToken<ImageUploader<Blob>>('backend');
    const OWNER = new InjectionToken<EditorJsUploadOwner<ImageUploader<Blob>>>(
      'owner',
    );
    const backend: ImageUploader<Blob> = {
      uploadByFile: async () => failure,
      uploadByUrl: async () => failure,
    };
    const parent = createEnvironmentInjector(
      [{ provide: BACKEND, useValue: backend }],
      Injector.NULL as EnvironmentInjector,
    );
    environments.push(parent);
    const children = [0, 1].map(() => {
      const env = createEnvironmentInjector(
        [
          {
            provide: OWNER,
            useFactory: () =>
              createEditorJsUploadOwner(inject(BACKEND), {
                destroyRef: inject(DestroyRef),
              }),
          },
        ],
        parent,
      );
      environments.push(env);
      return env;
    });
    const [a, b] = children.map((env) => env.get(OWNER));
    await a.uploader.uploadByUrl('a');
    await b.uploader.uploadByUrl('b');
    b.acknowledge(a.operations()[0].id);
    expect(b.hasErrors()).toBe(true);
    children[0].destroy();
    expect(a.disposed()).toBe(true);
    expect(b.disposed()).toBe(false);
    expect(b.operations()).toHaveLength(1);
  });
});
