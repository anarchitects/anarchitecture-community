import type {
  FileUploader,
  ImageUploader,
  UploadedFile,
  UrlUploader,
} from './uploader.js';

/** Combine explicit capabilities without losing service receivers or result types. */
export function composeImageUploader<
  Input,
  FileData extends UploadedFile,
  FileError,
  UrlData extends UploadedFile,
  UrlError,
>(
  files: FileUploader<Input, FileData, FileError>,
  urls: UrlUploader<UrlData, UrlError>,
): ImageUploader<Input, FileData | UrlData, FileError | UrlError> {
  const byFile = files?.uploadByFile;
  const byUrl = urls?.uploadByUrl;
  if (typeof byFile !== 'function' || typeof byUrl !== 'function')
    throw new TypeError('Image upload requires file and URL capabilities.');
  return Object.freeze({
    // Capture methods once; later replacement does not change this composition.
    uploadByFile: async (input: Input) => byFile.call(files, input),
    uploadByUrl: async (url: string) => byUrl.call(urls, url),
  });
}
