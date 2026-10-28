import type {
  UploadedFile,
  UploadFailure,
  UploadResponse,
} from './uploader.js';

/** Expected port failure or an unknown host exception; neither implies replay safety. */
export type UploadRetryOutcome<ErrorData = unknown> =
  | { readonly kind: 'failure'; readonly response: UploadFailure<ErrorData> }
  | { readonly kind: 'exception'; readonly error: unknown };

/** Schedule once after delayMs; return a synchronous, nonthrowing cancellation function. */
export type UploadScheduler = (
  resume: () => void,
  delayMs: number,
) => () => void;

export interface UploadRetryPolicy<ErrorData = unknown> {
  /** Includes the first attempt; integer from 1 through 10. */
  readonly maxAttempts: number;
  /** Host guarantees that repeating this operation is safe, including ambiguous completion. */
  readonly replaySafe: true;
  readonly shouldRetry: (
    outcome: UploadRetryOutcome<ErrorData>,
    attempt: number,
  ) => boolean;
  /** Milliseconds per retry, 0–30,000; cumulative scheduled delay cannot exceed 120,000. */
  readonly delayMs:
    | number
    | ((outcome: UploadRetryOutcome<ErrorData>, attempt: number) => number);
  readonly schedule: UploadScheduler;
}

export interface UploadOperationOptions<ErrorData = unknown> {
  /** Omit for exactly one attempt. No exception or expected failure is retried implicitly. */
  readonly retry?: UploadRetryPolicy<ErrorData>;
  /** Called immediately before each attempt; a throw terminates without invoking it. */
  readonly onAttempt?: (attempt: number) => void;
}

export interface UploadOperation<
  FileData extends UploadedFile = UploadedFile,
  ErrorData = unknown,
> {
  readonly result: Promise<UploadResponse<FileData, ErrorData>>;
  /** Settles locally and prevents future attempts. Does not abort transport or undo storage. */
  stop(): void;
}

export class UploadStoppedError extends Error {
  readonly code = 'stopped';
  constructor() {
    super('Upload operation stopped locally.');
    this.name = 'UploadStoppedError';
  }
}

function optionsRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  )
    throw new TypeError('Invalid upload operation options.');
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== 'string' ||
      !keys.includes(key) ||
      !descriptor ||
      !('value' in descriptor)
    )
      throw new TypeError('Invalid upload operation option.');
    copy[key] = descriptor.value;
  }
  return copy;
}

function validDelay(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 30_000
  );
}

/** Reject async policy callbacks while observing their eventual rejection. */
function synchronous(value: unknown): void {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  )
    return;
  const then: unknown = Reflect.get(value, 'then');
  if (typeof then !== 'function') return;
  void new Promise((resolve, reject) =>
    then.call(value, resolve, reject),
  ).catch(() => undefined);
  throw new TypeError('Upload policy callbacks must be synchronous.');
}

function snapshotOptions<ErrorData>(
  options: UploadOperationOptions<ErrorData>,
): UploadOperationOptions<ErrorData> {
  const record = optionsRecord(options, ['retry', 'onAttempt']);
  if (
    record['onAttempt'] !== undefined &&
    typeof record['onAttempt'] !== 'function'
  )
    throw new TypeError('Invalid upload attempt observer.');
  let retry: UploadRetryPolicy<ErrorData> | undefined;
  if (record['retry'] !== undefined) {
    const policy = optionsRecord(record['retry'], [
      'maxAttempts',
      'replaySafe',
      'shouldRetry',
      'delayMs',
      'schedule',
    ]);
    const max = policy['maxAttempts'];
    if (
      typeof max !== 'number' ||
      !Number.isInteger(max) ||
      max < 1 ||
      max > 10 ||
      policy['replaySafe'] !== true ||
      typeof policy['shouldRetry'] !== 'function' ||
      typeof policy['schedule'] !== 'function' ||
      !(
        typeof policy['delayMs'] === 'function' || validDelay(policy['delayMs'])
      )
    )
      throw new TypeError('Invalid upload retry policy.');
    retry = Object.freeze(policy) as unknown as UploadRetryPolicy<ErrorData>;
  }
  return {
    retry,
    onAttempt: record[
      'onAttempt'
    ] as UploadOperationOptions<ErrorData>['onAttempt'],
  };
}

/** Only inspect the control-flow envelope. File/JSON validation belongs to the consuming boundary. */
function responseKind(value: unknown): 0 | 1 {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Invalid upload response.');
  const status = Object.getOwnPropertyDescriptor(value, 'success');
  if (!status || !('value' in status))
    throw new TypeError('Invalid upload response.');
  if (status.value === 0 && !('file' in value)) return 0;
  const file = Object.getOwnPropertyDescriptor(value, 'file');
  if (
    status.value === 1 &&
    !('error' in value) &&
    file &&
    'value' in file &&
    file.value !== null &&
    typeof file.value === 'object' &&
    !Array.isArray(file.value)
  )
    return 1;
  throw new TypeError('Invalid upload response.');
}

/** Start one logical invocation in a microtask, with owner-local bounded retry and stop. */
export function createUploadOperation<
  FileData extends UploadedFile,
  ErrorData = unknown,
>(
  operation: (attempt: number) => Promise<UploadResponse<FileData, ErrorData>>,
  options: UploadOperationOptions<NoInfer<ErrorData>> = {},
): UploadOperation<FileData, ErrorData> {
  if (typeof operation !== 'function')
    throw new TypeError('Upload operation must be callable.');
  const { retry, onAttempt } = snapshotOptions(options);
  let finished = false;
  let attempt = 0;
  let totalDelay = 0;
  let cancelDelay: (() => void) | undefined;
  let resolve!: (value: UploadResponse<FileData, ErrorData>) => void;
  let reject!: (cause: unknown) => void;
  const result = new Promise<UploadResponse<FileData, ErrorData>>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const fail = (cause: unknown) => {
    if (finished) return;
    finished = true;
    reject(cause);
  };
  const succeed = (response: UploadResponse<FileData, ErrorData>) => {
    if (finished) return;
    finished = true;
    resolve(response);
  };
  const end = (outcome: UploadRetryOutcome<ErrorData>) => {
    if (outcome.kind === 'failure') succeed(outcome.response);
    else fail(outcome.error);
  };
  const failedAttempt = (outcome: UploadRetryOutcome<ErrorData>) => {
    if (finished) return;
    Object.freeze(outcome); // Policy may inspect, but cannot replace the original outcome.
    if (!retry || attempt >= retry.maxAttempts) {
      end(outcome);
      return;
    }
    try {
      const again = retry.shouldRetry(outcome, attempt);
      synchronous(again);
      if (finished) return; // Host callbacks may stop reentrantly.
      if (typeof again !== 'boolean')
        throw new TypeError('Upload retry classifier must return a boolean.');
      if (!again) {
        end(outcome);
        return;
      }
      const delay =
        typeof retry.delayMs === 'function'
          ? retry.delayMs(outcome, attempt)
          : retry.delayMs;
      synchronous(delay);
      if (finished) return;
      if (!validDelay(delay) || totalDelay + delay > 120_000)
        throw new RangeError('Upload retry delay exceeds its bounds.');
      totalDelay += delay;
      let resumed = false;
      const cancel = retry.schedule(() => {
        if (resumed || finished) return;
        resumed = true;
        cancelDelay = undefined;
        // Even a synchronous scheduler cannot recurse or launch before returning its cleanup.
        void Promise.resolve().then(run);
      }, delay);
      synchronous(cancel);
      if (typeof cancel !== 'function')
        throw new TypeError(
          'Upload scheduler must return a cancellation function.',
        );
      if (finished) synchronous(cancel());
      else if (!resumed) cancelDelay = cancel;
    } catch (cause) {
      fail(cause);
    }
  };
  const run = async () => {
    if (finished) return;
    attempt++;
    try {
      synchronous(onAttempt?.(attempt));
    } catch (cause) {
      fail(cause);
      return;
    }
    if (finished) return;
    let response: UploadResponse<FileData, ErrorData>;
    try {
      response = await operation(attempt);
    } catch (error) {
      failedAttempt({ kind: 'exception', error });
      return;
    }
    if (finished) return;
    try {
      if (responseKind(response) === 1) succeed(response);
      else
        failedAttempt({
          kind: 'failure',
          response: response as UploadFailure<ErrorData>,
        });
    } catch (cause) {
      fail(cause);
    }
  };
  void Promise.resolve().then(run);
  return Object.freeze({
    result,
    stop(): void {
      if (finished) return;
      const cancel = cancelDelay;
      cancelDelay = undefined;
      fail(new UploadStoppedError());
      // The stopped result is already settled, even if a broken host cleanup throws.
      synchronous(cancel?.());
    },
  });
}
