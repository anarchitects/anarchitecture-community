/** Persistable file metadata returned by a host; extend with application fields. */
export interface UploadedFile {
  /** URL usable by the consuming tool. The host owns URL validation and lifetime. */
  url: string;
}

/** Successful upload, following the Editor.js image upload response shape. */
export interface UploadSuccess<FileData extends UploadedFile = UploadedFile> {
  success: 1;
  file: FileData;
  error?: never;
}

/**
 * Expected upload failure. Error details are an optional host-defined extension;
 * they are not a standardized Editor.js image-tool error schema.
 */
export interface UploadFailure<ErrorData = unknown> {
  success: 0;
  error?: ErrorData;
  file?: never;
}

/** Narrow on success before consuming file metadata or host error details. */
export type UploadResponse<
  FileData extends UploadedFile = UploadedFile,
  ErrorData = unknown,
> = UploadSuccess<FileData> | UploadFailure<ErrorData>;

/**
 * Host-supplied file transport. Input is explicit (e.g. a browser File or server
 * byte payload); the public contract has no DOM or Node dependencies.
 * Rejected promises remain unknown exceptions for the host to handle.
 */
export interface FileUploader<
  Input,
  FileData extends UploadedFile = UploadedFile,
  ErrorData = unknown,
> {
  uploadByFile: (file: Input) => Promise<UploadResponse<FileData, ErrorData>>;
}

/** Host-supplied URL transport; accepting a URL does not itself fetch or store it. */
export interface UrlUploader<
  FileData extends UploadedFile = UploadedFile,
  ErrorData = unknown,
> {
  uploadByUrl: (url: string) => Promise<UploadResponse<FileData, ErrorData>>;
}

/** Image upload boundary for hosts supporting both file and URL workflows. */
export interface ImageUploader<
  Input,
  FileData extends UploadedFile = UploadedFile,
  ErrorData = unknown,
> extends FileUploader<Input, FileData, ErrorData>,
    UrlUploader<FileData, ErrorData> {}
