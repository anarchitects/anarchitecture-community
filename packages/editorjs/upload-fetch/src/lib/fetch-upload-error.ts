export type FetchUploadErrorCode =
  | 'http'
  | 'network'
  | 'response'
  | 'mapping'
  | 'cancelled'
  | 'timeout'
  | 'unsupported';

/** Safe display message; cause is diagnostic data and may contain host secrets. */
export class FetchUploadError extends Error {
  override readonly name = 'FetchUploadError';
  constructor(
    readonly code: FetchUploadErrorCode,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(`Upload ${code} failure.`, options);
  }
}
