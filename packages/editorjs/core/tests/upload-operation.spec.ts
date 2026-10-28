import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  composeImageUploader,
  createUploadOperation,
  UploadStoppedError,
  type FileUploader,
  type ImageUploader,
  type UploadOperation,
  type UploadOperationOptions,
  type UploadResponse,
  type UploadRetryPolicy,
  type UploadScheduler,
  type UrlUploader,
} from '../src/index.js';

interface Asset {
  url: string;
  id: number;
}
interface HostError {
  retryable: boolean;
}
const success: UploadResponse<Asset, HostError> = {
  success: 1,
  file: { url: '/asset', id: 42 },
};
const failure: UploadResponse<Asset, HostError> = {
  success: 0,
  error: { retryable: true },
};
const schedule: UploadScheduler = (resume, delay) => {
  const timer = setTimeout(resume, delay);
  return () => clearTimeout(timer);
};
function retry(
  overrides: Partial<UploadRetryPolicy<HostError>> = {},
): UploadRetryPolicy<HostError> {
  return {
    maxAttempts: 3,
    replaySafe: true,
    shouldRetry: () => true,
    delayMs: 10,
    schedule,
    ...overrides,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
afterEach(() => {
  vi.useRealTimers();
});

describe('explicit uploader composition', () => {
  it('preserves prototype methods, receivers, inputs and distinct result/error types', async () => {
    class Files implements FileUploader<Uint8Array, Asset, HostError> {
      response = success;
      async uploadByFile(input: Uint8Array) {
        expect(input).toBe(bytes);
        return this.response;
      }
    }
    type Remote = { url: string; remote: true };
    type UrlError = { code: 'denied' };
    const denied: UploadResponse<Remote, UrlError> = {
      success: 0,
      error: { code: 'denied' },
    };
    class Urls implements UrlUploader<Remote, UrlError> {
      response = denied;
      async uploadByUrl(url: string) {
        expect(url).toBe('/source');
        return this.response;
      }
    }
    const bytes = new Uint8Array([1]);
    const files = new Files();
    const uploader = composeImageUploader(files, new Urls());
    expectTypeOf(uploader).toEqualTypeOf<
      ImageUploader<Uint8Array, Asset | Remote, HostError | UrlError>
    >();
    const { uploadByFile, uploadByUrl } = uploader;
    files.uploadByFile = async () => {
      throw new Error('replacement must not be called');
    };
    expect(await uploadByFile(bytes)).toBe(success);
    expect(await uploadByUrl('/source')).toBe(denied);
    expect(Object.isFrozen(uploader)).toBe(true);
  });

  it('converts synchronous host throws to rejections and preserves rejected causes', async () => {
    const cause = { host: 'opaque' };
    const uploader = composeImageUploader(
      {
        uploadByFile: () => {
          throw cause;
        },
      },
      { uploadByUrl: () => Promise.reject(cause) },
    );
    await expect(uploader.uploadByFile(undefined)).rejects.toBe(cause);
    await expect(uploader.uploadByUrl('/source')).rejects.toBe(cause);
  });

  it('rejects missing capabilities at construction without invoking the supplied method', () => {
    const files = {
      uploadByFile: vi.fn(
        async (): Promise<UploadResponse<Asset, HostError>> => success,
      ),
    };
    expect(() => composeImageUploader(files, {} as UrlUploader)).toThrow(
      TypeError,
    );
    expect(() =>
      composeImageUploader(null as unknown as FileUploader<unknown>, {
        uploadByUrl: async () => failure,
      }),
    ).toThrow(TypeError);
    expect(files.uploadByFile).not.toHaveBeenCalled();
  });
});

describe('upload operations', () => {
  it('defaults to one attempt and preserves successful metadata and opaque host errors by identity', async () => {
    const method = vi.fn(
      async (): Promise<UploadResponse<Asset, HostError>> => success,
    );
    const operation = createUploadOperation(method);
    expectTypeOf(operation).toEqualTypeOf<UploadOperation<Asset, HostError>>();
    expect(method).not.toHaveBeenCalled();
    expect(await operation.result).toBe(success);
    expect(method).toHaveBeenCalledExactlyOnceWith(1);
    operation.stop();
    const opaque = new Error('host failure');
    const response = { success: 0 as const, error: opaque };
    const denied = vi.fn(async () => response);
    expect(await createUploadOperation(denied).result).toBe(response);
    expect(denied).toHaveBeenCalledTimes(1);
  });

  it.each(['throw', 'reject'] as const)(
    'preserves a host %s with no default retry',
    async (kind) => {
      const cause = { code: 'transport' };
      const method = vi.fn(() => {
        if (kind === 'throw') throw cause;
        return Promise.reject(cause);
      });
      await expect(createUploadOperation(method).result).rejects.toBe(cause);
      expect(method).toHaveBeenCalledTimes(1);
    },
  );

  it('retries classified failures/exceptions with exact attempt and delay accounting', async () => {
    vi.useFakeTimers();
    const cause = new Error('ambiguous completion');
    const observed: number[] = [];
    const classify = vi.fn(() => true);
    const method = vi.fn(async (attempt: number) => {
      if (attempt === 1) return failure;
      if (attempt === 2) throw cause;
      return success;
    });
    const operation = createUploadOperation<Asset, HostError>(method, {
      retry: retry({
        shouldRetry: classify,
        delayMs: (_, attempt) => attempt * 10,
      }),
      onAttempt: (n) => {
        observed.push(n);
      },
    });
    await vi.advanceTimersByTimeAsync(9);
    expect(method).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(method).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(19);
    expect(method).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(await operation.result).toBe(success);
    expect(observed).toEqual([1, 2, 3]);
    expect(classify.mock.calls).toEqual([
      [{ kind: 'failure', response: failure }, 1],
      [{ kind: 'exception', error: cause }, 2],
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['failure', 'exception'] as const)(
    'preserves the last %s on exhaustion',
    async (kind) => {
      vi.useFakeTimers();
      const last = { success: 0 as const, error: { retryable: true } };
      const cause = { reason: 'last attempt' };
      const classify = vi.fn(() => true);
      const operation = createUploadOperation<Asset, HostError>(
        async (n) => {
          if (n < 3) return failure;
          if (kind === 'exception') throw cause;
          return last;
        },
        { retry: retry({ shouldRetry: classify }) },
      );
      const check =
        kind === 'failure'
          ? expect(operation.result).resolves.toBe(last)
          : expect(operation.result).rejects.toBe(cause);
      await vi.runAllTimersAsync();
      await check;
      expect(classify).toHaveBeenCalledTimes(2);
    },
  );

  it('lets the caller decline retry and never classifies success', async () => {
    const classify = vi.fn(() => false);
    expect(
      await createUploadOperation(async () => failure, {
        retry: retry({ shouldRetry: classify }),
      }).result,
    ).toBe(failure);
    expect(
      await createUploadOperation<Asset, HostError>(async () => success, {
        retry: retry({ shouldRetry: classify }),
      }).result,
    ).toBe(success);
    expect(classify).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    {},
    [],
    { success: true, file: {} },
    { success: 1 },
    { success: 0, file: undefined },
    { success: 1, file: {}, error: undefined },
    { success: 1, file: [] },
  ])(
    'rejects malformed response %j without classification',
    async (response) => {
      const classify = vi.fn(() => true);
      const operation = createUploadOperation(
        async () => response as UploadResponse<Asset, HostError>,
        { retry: { ...retry(), shouldRetry: classify } },
      );
      await expect(operation.result).rejects.toThrow(TypeError);
      expect(classify).not.toHaveBeenCalled();
    },
  );

  it('does not invoke response discriminant accessors or normalize host metadata', async () => {
    const getter = vi.fn(() => 1);
    const response = {
      get success() {
        return getter();
      },
      file: {},
    } as unknown as UploadResponse;
    await expect(
      createUploadOperation(async () => response).result,
    ).rejects.toThrow(TypeError);
    expect(getter).not.toHaveBeenCalled();
    const metadata = {
      success: 1 as const,
      file: { url: '/asset', host: new Map([['opaque', 1]]) },
    };
    expect(await createUploadOperation(async () => metadata).result).toBe(
      metadata,
    );
  });

  it.each([
    { maxAttempts: 0 },
    { maxAttempts: 11 },
    { maxAttempts: 1.5 },
    { maxAttempts: Infinity },
    { replaySafe: false },
    { shouldRetry: undefined },
    { schedule: undefined },
    { delayMs: -1 },
    { delayMs: NaN },
    { delayMs: 30_001 },
    { delayMs: Infinity },
  ])('rejects invalid policy %j before any attempt', (invalid) => {
    const method = vi.fn(
      async (): Promise<UploadResponse<Asset, HostError>> => success,
    );
    expect(() =>
      createUploadOperation(method, {
        retry: { ...retry(), ...invalid } as UploadRetryPolicy<HostError>,
      }),
    ).toThrow(TypeError);
    expect(method).not.toHaveBeenCalled();
  });

  it('validates/snapshots configuration without invoking accessors', async () => {
    const getter = vi.fn();
    expect(() =>
      createUploadOperation<Asset, HostError>(async () => success, {
        get retry() {
          getter();
          return retry();
        },
      }),
    ).toThrow(TypeError);
    expect(getter).not.toHaveBeenCalled();
    expect(() =>
      createUploadOperation<Asset, HostError>(async () => success, {
        unknown: true,
      } as UploadOperationOptions),
    ).toThrow(TypeError);
    const policy = { ...retry(), maxAttempts: 1 };
    const method = vi.fn(async () => failure);
    const operation = createUploadOperation<Asset, HostError>(method, {
      retry: policy,
    });
    policy.maxAttempts = 10;
    expect(await operation.result).toBe(failure);
    expect(method).toHaveBeenCalledTimes(1);
  });

  it('bounds cumulative delay and rejects invalid dynamic delays', async () => {
    vi.useFakeTimers();
    const method = vi.fn(async () => failure);
    const operation = createUploadOperation<Asset, HostError>(method, {
      retry: retry({ maxAttempts: 10, delayMs: 30_000 }),
    });
    const check = expect(operation.result).rejects.toThrow(RangeError);
    await vi.runAllTimersAsync();
    await check;
    expect(method).toHaveBeenCalledTimes(5);
    expect(vi.getTimerCount()).toBe(0);
    await expect(
      createUploadOperation(async () => failure, {
        retry: retry({ delayMs: () => -1 }),
      }).result,
    ).rejects.toThrow(RangeError);
  });

  it.each(['onAttempt', 'shouldRetry', 'delayMs', 'schedule'] as const)(
    'terminates when %s throws',
    async (key) => {
      const cause = new Error(key);
      const throwing = () => {
        throw cause;
      };
      const method = vi.fn(async () => failure);
      const options =
        key === 'onAttempt'
          ? { onAttempt: throwing }
          : { retry: retry({ [key]: throwing }) };
      await expect(createUploadOperation(method, options).result).rejects.toBe(
        cause,
      );
      expect(method).toHaveBeenCalledTimes(key === 'onAttempt' ? 0 : 1);
    },
  );

  it.each(['onAttempt', 'shouldRetry', 'delayMs', 'schedule'] as const)(
    'rejects an async %s and observes its rejection',
    async (key) => {
      const asyncCallback = async () => {
        throw new Error('invalid async callback');
      };
      const options = (key === 'onAttempt'
        ? { onAttempt: asyncCallback }
        : {
            retry: { ...retry(), [key]: asyncCallback },
          }) as unknown as UploadOperationOptions<HostError>;
      await expect(
        createUploadOperation(async () => failure, options).result,
      ).rejects.toThrow('must be synchronous');
    },
  );

  it('stops before start without invoking host callbacks', async () => {
    const method = vi.fn(
      async (): Promise<UploadResponse<Asset, HostError>> => success,
    );
    const operation = createUploadOperation(method);
    const check = expect(operation.result).rejects.toBeInstanceOf(
      UploadStoppedError,
    );
    operation.stop();
    operation.stop();
    await check;
    expect(method).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'] as const)(
    'settles on stop during a held upload and observes late %s',
    async (kind) => {
      const held = deferred<UploadResponse<Asset, HostError>>();
      const classify = vi.fn(() => true);
      const method = vi.fn(() => held.promise);
      const operation = createUploadOperation<Asset, HostError>(method, {
        retry: retry({ shouldRetry: classify }),
      });
      await Promise.resolve();
      const check = expect(operation.result).rejects.toMatchObject({
        code: 'stopped',
      });
      operation.stop();
      await check;
      if (kind === 'resolve') held.resolve(success);
      else held.reject(new Error('late rejection'));
      await Promise.resolve();
      await Promise.resolve();
      expect(method).toHaveBeenCalledTimes(1);
      expect(classify).not.toHaveBeenCalled();
      await expect(operation.result).rejects.toBeInstanceOf(UploadStoppedError);
    },
  );

  it('clears a retry delay on stop and ignores a late scheduler callback', async () => {
    vi.useFakeTimers();
    let resume!: () => void;
    const cancel = vi.fn();
    const method = vi.fn(async () => failure);
    const operation = createUploadOperation<Asset, HostError>(method, {
      retry: retry({
        schedule: (callback) => {
          resume = callback;
          return cancel;
        },
      }),
    });
    await vi.advanceTimersByTimeAsync(0);
    const check = expect(operation.result).rejects.toBeInstanceOf(
      UploadStoppedError,
    );
    operation.stop();
    resume();
    await check;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(method).toHaveBeenCalledTimes(1);
    const timed = createUploadOperation(async () => failure, {
      retry: retry(),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    const timedCheck = expect(timed.result).rejects.toBeInstanceOf(
      UploadStoppedError,
    );
    timed.stop();
    await timedCheck;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps simultaneous operations independent, including stopping one during backoff', async () => {
    vi.useFakeTimers();
    const first = createUploadOperation(async () => failure, {
      retry: retry(),
    });
    const second = createUploadOperation<Asset, HostError>(
      async (n) => (n === 1 ? failure : success),
      { retry: retry() },
    );
    await vi.advanceTimersByTimeAsync(0);
    const check = expect(first.result).rejects.toBeInstanceOf(
      UploadStoppedError,
    );
    first.stop();
    await check;
    await vi.advanceTimersByTimeAsync(10);
    expect(await second.result).toBe(success);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['observer', 'classifier', 'delay', 'scheduler'] as const)(
    'honors reentrant stop from the %s',
    async (location) => {
      const stop = () => operation.stop();
      const cancel = vi.fn();
      const method = vi.fn(async () => failure);
      const operation = createUploadOperation<Asset, HostError>(method, {
        onAttempt: () => {
          if (location === 'observer') stop();
        },
        retry: retry({
          shouldRetry: () => {
            if (location === 'classifier') stop();
            return true;
          },
          delayMs: () => {
            if (location === 'delay') stop();
            return 0;
          },
          schedule: () => {
            stop();
            return cancel;
          },
        }),
      });
      await expect(operation.result).rejects.toBeInstanceOf(UploadStoppedError);
      expect(method).toHaveBeenCalledTimes(location === 'observer' ? 0 : 1);
      expect(cancel).toHaveBeenCalledTimes(location === 'scheduler' ? 1 : 0);
    },
  );

  it('handles a synchronous/duplicate scheduler callback without overlapping attempts', async () => {
    const method = vi.fn(async (n) => (n === 3 ? success : failure));
    const operation = createUploadOperation<Asset, HostError>(method, {
      retry: retry({
        delayMs: 0,
        schedule: (resume) => {
          resume();
          resume();
          return () => undefined;
        },
      }),
    });
    expect(await operation.result).toBe(success);
    expect(method.mock.calls).toEqual([[1], [2], [3]]);
  });

  it('rejects invalid classifier/scheduler returns without starting another attempt', async () => {
    for (const overrides of [
      { shouldRetry: () => 'yes' },
      { schedule: () => undefined },
    ]) {
      const method = vi.fn(async () => failure);
      const operation = createUploadOperation(method, {
        retry: {
          ...retry(),
          ...overrides,
        } as unknown as UploadRetryPolicy<HostError>,
      });
      await expect(operation.result).rejects.toThrow(TypeError);
      expect(method).toHaveBeenCalledTimes(1);
    }
  });

  it.each(['throw', 'async'] as const)(
    'settles stop even if scheduler cleanup is broken (%s)',
    async (kind) => {
      vi.useFakeTimers();
      const cause = new Error('broken cleanup');
      const cancel =
        kind === 'throw'
          ? () => {
              throw cause;
            }
          : async () => {
              throw cause;
            };
      const operation = createUploadOperation(async () => failure, {
        retry: retry({ schedule: () => cancel }),
      });
      await vi.advanceTimersByTimeAsync(0);
      const check = expect(operation.result).rejects.toBeInstanceOf(
        UploadStoppedError,
      );
      if (kind === 'throw') expect(() => operation.stop()).toThrow(cause);
      else expect(() => operation.stop()).toThrow('must be synchronous');
      await check;
      expect(() => operation.stop()).not.toThrow();
    },
  );
});
