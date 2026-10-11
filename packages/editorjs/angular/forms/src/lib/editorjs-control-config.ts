import type {
  EditorJsConfig,
  EditorJsTools,
} from '@anarchitects/editorjs-angular';

/** Initialization-only editor options; the Forms adapter owns availability. */
export type EditorJsControlConfig<Tools extends EditorJsTools = EditorJsTools> =
  Readonly<Omit<EditorJsConfig<Tools>, 'readOnly'> & { readOnly?: never }>;
