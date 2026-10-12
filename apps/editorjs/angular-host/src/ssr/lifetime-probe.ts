import { isPlatformBrowser } from '@angular/common';
import { ElementRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import {
  EDITOR_JS_LOADER,
  type EditorJsLoader,
} from '@anarchitects/editorjs-angular';
import type { OutputData } from '@anarchitects/editorjs-core';

export type Gate = 'load' | 'ready' | 'save';
export interface ProbeSession {
  wait(point: Gate, data?: OutputData): Promise<void>;
  record(event: string): void;
  captureChange(notify: () => void): void;
  captureHolder(holder: HTMLElement): void;
}
export interface LifetimeProbe {
  enter(owner: string): ProbeSession;
}
declare global {
  interface Window {
    editorLifetimeProbe?: LifetimeProbe;
  }
}

/** Optional browser-test observer; no global request state or alternate editor queue. */
@Injectable()
export class LifetimeWork {
  readonly #browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  session?: ProbeSession;
  start(): void {
    if (this.#browser)
      this.session = window.editorLifetimeProbe?.enter(
        this.#host.nativeElement.getAttribute('data-owner') ?? 'A',
      );
  }
  record(event: string): void {
    this.session?.record(event);
  }
}

export function controlledLifetimeLoader(): EditorJsLoader {
  const load = inject(EDITOR_JS_LOADER, { skipSelf: true });
  const work = inject(LifetimeWork);
  return async () => {
    work.start();
    const session = work.session;
    await session?.wait('load');
    const create = await load();
    work.record('loaded');
    return (options) => {
      const editor = create(options);
      work.record('created');
      session?.captureChange(options.onChange);
      session?.captureHolder(options.holder);
      return {
        isReady: editor.isReady.then(async () => {
          work.record('upstream-ready');
          await session?.wait('ready');
          work.record('readiness-settled');
        }),
        save: async () => {
          const data = await editor.save();
          await session?.wait('save', data);
          work.record('save-settled');
          return data;
        },
        render: (data) => editor.render(data),
        clear: () => editor.clear(),
        focus: (atEnd) => editor.focus(atEnd),
        get readOnly() {
          return editor.readOnly;
        },
        destroy: () => {
          editor.destroy();
          work.record('destroyed');
        },
      };
    };
  };
}
