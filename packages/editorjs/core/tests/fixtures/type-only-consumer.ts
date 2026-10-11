// eslint-disable-next-line @nx/enforce-module-boundaries -- Compiled outside the workspace against the packed package.
import type {
  JsonArray,
  JsonObject,
  JsonValue,
  OutputBlockData,
  OutputBlockDataFor,
  OutputData,
  ImageUploader,
  ToolConfiguration,
  ToolRegistration,
  UploadedFile,
  UploadResponse,
  OutputDataParseResult,
  OutputDataNormalizationOptions,
  OutputDataValidationOptions,
  OutputDataValidationResult,
  ToolDataValidator,
  ContentParseResult,
  ContentProvenance,
  ContentSchemaVersion,
  ContentProducer,
  FileUploader,
  UrlUploader,
  UploadSuccess,
  UploadFailure,
  ToolConstructor,
  ToolboxEntry,
  ToolOptions,
  OutputDataParseError,
  OutputDataParseErrorCode,
  OutputDataValidationError,
  OutputDataValidationErrorCode,
  ToolValidationContext,
  ToolValidationIssue,
  ToolValidationResult,
  EditorJsApi,
  EditorJsReadyEvent,
  EditorJsChangeEvent,
  EditorJsErrorEvent,
  EditorJsOperation,
  EditorJsDocumentCoordinator,
  EditorJsOperationError,
  EditorJsDocumentDriver,
  EditorJsDocumentCoordinatorOptions,
} from '@anarchitects/editorjs-core';

// Keep every documented type reachable through the published root declarations.
export interface AdditionalPublicContracts {
  schema: ContentSchemaVersion;
  producer: ContentProducer;
  fileUploader: FileUploader<Uint8Array>;
  urlUploader: UrlUploader;
  uploadSuccess: UploadSuccess;
  uploadFailure: UploadFailure;
  constructor: ToolConstructor;
  toolbox: ToolboxEntry;
  toolOptions: ToolOptions;
  parseError: OutputDataParseError;
  parseCode: OutputDataParseErrorCode;
  validationError: OutputDataValidationError;
  validationCode: OutputDataValidationErrorCode;
  context: ToolValidationContext;
  issue: ToolValidationIssue;
  result: ToolValidationResult;
  editor: EditorJsApi;
  ready: EditorJsReadyEvent;
  change: EditorJsChangeEvent;
  editorError: EditorJsErrorEvent;
  operation: EditorJsOperation;
  coordinator: EditorJsDocumentCoordinator;
  operationError: EditorJsOperationError;
  driver: EditorJsDocumentDriver;
  coordinatorOptions: EditorJsDocumentCoordinatorOptions;
}

interface ToolData {
  paragraph: { text: string };
  rating: { score: number; maximum: number };
}

type Block = OutputBlockDataFor<ToolData>;

export const document: OutputData<Block> = {
  blocks: [
    { type: 'paragraph', data: { text: 'Typed consumer' } },
    { id: 'rating', type: 'rating', data: { score: 4, maximum: 5 } },
  ],
};

export const unknownDocument: OutputData = document;

export async function saveTypedEditor(
  api: EditorJsApi<Block>,
): Promise<OutputData<Block>> {
  await api.render(document);
  await api.clear();
  const focused: boolean = await api.focus();
  const readOnly: boolean = await api.setReadOnly(true);
  void focused;
  void readOnly;
  return api.save();
}

export function describeChange(event: EditorJsChangeEvent<Block>): string {
  return event.data.blocks.map(summarize).join(',');
}
export const singleBlock: OutputBlockData<'custom', { value: boolean }> = {
  type: 'custom',
  data: { value: true },
};

export function summarize(block: Block): string {
  if (block.type === 'paragraph') {
    return block.data.text;
  }
  return `${block.data.score}/${block.data.maximum}`;
}

export const array: JsonArray = [null, true, 1, 'text'];
export const object: JsonObject = { nested: array };
export const value: JsonValue = object;

// @ts-expect-error A known type cannot carry another tool's data.
export const mismatched: Block = { type: 'rating', data: { text: 'wrong' } };
// @ts-expect-error Saved document metadata must use a numeric timestamp.
export const invalidTime: OutputData = { blocks: [], time: 'now' };
// @ts-expect-error Unknown plugin data is opaque until narrowed or validated.
export const unsafeText = unknownDocument.blocks[0].data.text;
// @ts-expect-error JSON values cannot contain functions.
export const notJson: JsonValue = { callback: () => 'text' };

interface ByteInput {
  name: string;
  bytes: Uint8Array;
}

interface Asset extends UploadedFile {
  assetId: string;
}

interface HostError {
  code: string;
  message: string;
}

interface ImageConfig {
  uploader: ImageUploader<ByteInput, Asset, HostError>;
  captionPlaceholder?: string;
}

// A class supplied by a downstream custom-tool integration, not by core.
declare class CustomImageTool {
  constructor(options: { config?: ImageConfig });
}

// The host supplies actual transport and persistence. No fetch, File, or Buffer
// declarations are needed by this server-side consumer.
export function configureHost(
  transport: ImageUploader<ByteInput, Asset, HostError>,
): ToolConfiguration<typeof CustomImageTool, ImageConfig, { caption: string }> {
  return {
    class: CustomImageTool,
    config: { uploader: transport, captionPlaceholder: 'Describe this image' },
    inlineToolbar: ['bold'],
    toolbox: { title: 'Image', data: { caption: '' } },
  };
}

export const directRegistration: ToolRegistration<typeof CustomImageTool> =
  CustomImageTool;

export function describeUpload(
  result: UploadResponse<Asset, HostError>,
): string {
  if (result.success === 1) {
    return `${result.file.assetId}: ${result.file.url}`;
  }
  // @ts-expect-error Failed uploads do not expose a usable file.
  const missingUrl = result.file.url;
  void missingUrl;
  return result.error?.message ?? 'Upload failed';
}

export const uploadFailure: UploadResponse<Asset, HostError> = {
  success: 0,
  error: { code: 'rejected', message: 'Host rejected upload' },
};

// @ts-expect-error A success result must carry file metadata with a URL.
export const invalidUpload: UploadResponse = { success: 1, file: {} };
export const booleanStatus: UploadResponse = {
  // @ts-expect-error Upload status uses numeric literal discriminants.
  success: true,
  file: { url: '/image.png' },
};

export function describeParsing(result: OutputDataParseResult): string {
  if (!result.ok) {
    return `${result.error.code}: ${result.error.path.join('.')}: ${result.error.message}`;
  }
  // @ts-expect-error Parsing the envelope does not establish a custom tool schema.
  const unsafe = result.data.blocks[0].data.text;
  void unsafe;
  return `${result.data.blocks.length} blocks`;
}

export const customValidator: ToolDataValidator = (data) => {
  if (
    data !== null &&
    typeof data === 'object' &&
    'text' in data &&
    typeof data.text === 'string'
  ) {
    return { ok: true };
  }
  return {
    ok: false,
    errors: [
      { path: ['text'], code: 'text_required', message: 'Expected text.' },
    ],
  };
};

export const validationOptions: OutputDataValidationOptions = {
  blockIds: 'required',
  unknownTools: 'reject',
  toolValidators: new Map([['paragraph', customValidator]]),
};

export function describeValidation(result: OutputDataValidationResult): string {
  if (!result.ok) return result.errors.map((error) => error.message).join('; ');
  // @ts-expect-error Validation does not assert that all plugin payloads are paragraphs.
  const text = result.data.blocks[0].data.text;
  void text;
  return `${result.data.blocks.length} blocks`;
}

export const provenance: ContentProvenance = {
  schema: { id: 'example/content', version: '1' },
  producer: { name: 'example-host' },
  toolVersions: { paragraph: '2.11.6' },
};

export function rawContent(result: ContentParseResult): OutputData | undefined {
  return result.ok ? result.data : undefined;
}

export const normalizationOptions: OutputDataNormalizationOptions = {
  symbolKeys: 'omit',
};
export const invalidNormalizationOptions: OutputDataNormalizationOptions = {
  // @ts-expect-error only explicit symbol-key policies are supported
  symbolKeys: 'strip',
};
