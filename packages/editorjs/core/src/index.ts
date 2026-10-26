export type {
  JsonArray,
  JsonObject,
  JsonValue,
  OutputBlockData,
  OutputBlockDataFor,
  OutputData,
} from './lib/output-data.js';
export type {
  ToolConfiguration,
  ToolConstructor,
  ToolOptions,
  ToolRegistration,
  ToolboxEntry,
} from './lib/tool-configuration.js';
export type {
  FileUploader,
  ImageUploader,
  UploadedFile,
  UploadFailure,
  UploadResponse,
  UploadSuccess,
  UrlUploader,
} from './lib/uploader.js';
export {
  composeToolRegistry,
  selectToolRegistry,
  validateToolReferences,
  createToolMap,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
} from './lib/tool-registry.js';
export { ToolRegistryError } from './lib/tool-registry-contracts.js';
export { createToolResolver } from './lib/tool-resolver.js';
export type {
  ToolDefinition,
  ToolKind,
  BuiltInTool,
  BuiltInToolProfile,
  ToolReferenceContext,
  ToolRegistry,
  ToolRegistryEntries,
  ToolRegistryTools,
  ToolRegistryErrorCode,
  ToolResolver,
} from './lib/tool-registry-contracts.js';
export {
  normalizeOutputData,
  parseOutputData,
} from './lib/parse-output-data.js';
export { parseContentWithProvenance } from './lib/content-provenance.js';
export type {
  ContentParseResult,
  ContentProducer,
  ContentProvenance,
  ContentSchemaVersion,
} from './lib/content-provenance.js';
export { validateOutputData } from './lib/validate-output-data.js';
export type {
  OutputDataValidationError,
  OutputDataValidationErrorCode,
  OutputDataValidationOptions,
  OutputDataValidationResult,
  ToolDataValidator,
  ToolValidationContext,
  ToolValidationIssue,
  ToolValidationResult,
} from './lib/validate-output-data.js';
export type {
  OutputDataNormalizationOptions,
  OutputDataParseError,
  OutputDataParseErrorCode,
  OutputDataParseResult,
} from './lib/parse-output-data.js';

export type {
  EditorJsApi,
  EditorJsChangeEvent,
  EditorJsErrorEvent,
  EditorJsOperation,
  EditorJsReadyEvent,
} from './lib/editor-contracts.js';
export { EditorJsDocumentCoordinator } from './lib/editor-document-coordinator.js';
export { EditorJsOperationError } from './lib/editor-contracts.js';
export type {
  EditorJsDocumentDriver,
  EditorJsDocumentCoordinatorOptions,
} from './lib/editor-document-coordinator.js';
