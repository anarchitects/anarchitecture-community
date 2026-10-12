import { DestroyRef, inject } from '@angular/core';
import {
  EDITOR_JS_LOADER,
  type EditorJsLoader,
} from '@anarchitects/editorjs-angular';
import { RequestState } from './request-state';

/** Observe the public real loader without replacing it with a server stub. */
export function observedLoader(): EditorJsLoader {
  const load = inject(EDITOR_JS_LOADER, { skipSelf: true });
  const context = inject(RequestState).context;
  if (context) {
    context.loaders++;
    inject(DestroyRef).onDestroy(() => {
      context.loadersDestroyed++;
      context.onDisposed();
    });
  }
  return async () => {
    if (context) context.calls++;
    const create = await load();
    return (options) => {
      if (context) context.instances++;
      return create(options);
    };
  };
}
