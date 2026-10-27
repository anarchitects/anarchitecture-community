import List from '@editorjs/list';
import type { BlockToolConstructable } from '@editorjs/editorjs';

/** Preserve upstream editing while returning JSON-compatible optional counters. */
export class ListTool extends List {
  override save(): ReturnType<List['save']> {
    const data = super.save();
    if (data.style !== 'ordered') return data;
    // Upstream emits own undefined start/counterType properties when unset.
    // Omit only those optional fields; do not fill defaults or sanitize extensions.
    const meta = { ...data.meta };
    if ('start' in meta && meta.start === undefined) delete meta.start;
    if ('counterType' in meta && meta.counterType === undefined)
      delete meta.counterType;
    return { ...data, meta };
  }
}
ListTool satisfies BlockToolConstructable;
