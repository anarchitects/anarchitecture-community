import type { ToolRegistration } from '@anarchitects/editorjs-core';
import type { EditorConfig } from '@editorjs/editorjs';

/** Consumer-owned tool names and registrations; no tools are installed implicitly. */
export type EditorJsTools = Record<string, ToolRegistration>;

type OwnedOptions = 'holder' | 'holderId' | 'data' | 'onReady' | 'onChange';

/**
 * Initialization-only options. The wrapper owns its holder, data input and events.
 * Optional never fields also reject pre-existing upstream config objects.
 * Tool constructors must implement the Editor.js tool API at runtime.
 */
export type EditorJsConfig<Tools extends EditorJsTools = EditorJsTools> =
  Readonly<
    Omit<EditorConfig, OwnedOptions | 'tools'> & { tools?: Tools } & {
      [Key in OwnedOptions]?: never;
    }
  >;
