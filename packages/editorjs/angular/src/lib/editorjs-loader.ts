import { isPlatformBrowser } from '@angular/common';
import {
  inject,
  InjectionToken,
  makeEnvironmentProviders,
  PLATFORM_ID,
  type EnvironmentProviders,
} from '@angular/core';
import {
  normalizeOutputData,
  type OutputData,
} from '@anarchitects/editorjs-core';
import type { EditorConfig } from '@editorjs/editorjs';
import type { EditorJsConfig } from './editorjs-contracts.js';

/** Minimal raw runtime seam. Only the owner may use or destroy this instance. */
export interface EditorJsInstance {
  readonly isReady: Promise<void>;
  save(): Promise<OutputData>;
  render(data: OutputData): Promise<void>;
  clear(): void | Promise<void>;
  focus(atEnd?: boolean): boolean;
  readonly readOnly: {
    readonly isEnabled?: boolean;
    toggle(readOnly: boolean): Promise<boolean>;
  };
  destroy(): void;
}

/**
 * Owner-only creation request. Supply document data and a live holder.
 * Factories normalize/copy data through core before passing it to the editor.
 * onChange is an invalidation notification, not a saved document or user intent.
 */
export interface EditorJsCreateOptions {
  readonly holder: HTMLElement;
  readonly config?: EditorJsConfig;
  readonly data?: OutputData;
  readonly onChange: () => void;
}

/** Synchronous creation lets the owner check destruction after asynchronous loading. */
export type EditorJsFactory = (
  options: EditorJsCreateOptions,
) => EditorJsInstance;

/** Load code only; do not create, cache or retain any editor instance here. */
export type EditorJsLoader = () => Promise<EditorJsFactory>;

/**
 * Stateless loader infrastructure. Resolving this token never imports Editor.js.
 * Call only from a browser owner's initialization path after rendering its holder.
 */
export const EDITOR_JS_LOADER = new InjectionToken<EditorJsLoader>(
  'anarchitects.editorjs.loader',
  {
    providedIn: 'root',
    factory: () => {
      const platformId = inject(PLATFORM_ID);
      return async () => {
        if (!isPlatformBrowser(platformId)) {
          throw new Error(
            'Editor.js initialization requires a browser platform.',
          );
        }
        const { default: EditorJS } = await import('@editorjs/editorjs');
        return ({ holder, config, data, onChange }) => {
          const normalized = normalizeOutputData(
            data === undefined ? { blocks: [] } : data,
          );
          if (!normalized.ok) {
            throw new TypeError(normalized.error.message, {
              cause: normalized.error,
            });
          }
          return new EditorJS({
            ...config,
            // Core preserves constructor/config types without requiring a DOM API.
            // The host is responsible for supplying valid Editor.js tool classes.
            tools: config?.tools as EditorConfig['tools'],
            // Apply owned fields last even when untyped callers bypass the contract.
            holderId: undefined,
            holder,
            data: normalized.data,
            onReady: undefined,
            onChange,
          });
        };
      };
    },
  },
);

/** Override loading in an application/route environment without sharing editor state. */
export function provideEditorJsLoader(
  loader: EditorJsLoader,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: EDITOR_JS_LOADER, useValue: loader },
  ]);
}
