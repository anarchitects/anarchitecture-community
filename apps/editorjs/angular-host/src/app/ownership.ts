import { inject, Injectable, signal } from '@angular/core';
import {
  EDITOR_JS_LOADER,
  type EditorJsLoader,
} from '@anarchitects/editorjs-angular';

/** Test-host instrumentation: counts resources without retaining editor instances. */
@Injectable({ providedIn: 'root' })
export class Ownership {
  readonly created = signal(0);
  readonly destroyed = signal(0);
  readonly outputs = signal(0);
}

export function observedLoader(): EditorJsLoader {
  // Delegate to the package's real lazy loader in the parent application injector.
  const load = inject(EDITOR_JS_LOADER, { skipSelf: true });
  const ownership = inject(Ownership);
  return async () => {
    const create = await load();
    return (options) => {
      const editor = create(options);
      ownership.created.update((count) => count + 1);
      return {
        isReady: editor.isReady,
        save: () => editor.save(),
        render: (data) => editor.render(data),
        clear: () => editor.clear(),
        focus: (atEnd) => editor.focus(atEnd),
        get readOnly() {
          return editor.readOnly;
        },
        destroy: () => {
          editor.destroy();
          ownership.destroyed.update((count) => count + 1);
        },
      };
    };
  };
}
