import { afterEach, expect, it, vi } from 'vitest';
import type { BlockToolConstructable } from '@editorjs/editorjs';
import List from '@editorjs/list';
import { ListTool } from '../src/browser.js';
import { validateListData } from '../src/index.js';

afterEach(() => vi.restoreAllMocks());
it('keeps upstream rendering and read-only support through the Editor.js constructor contract', () => {
  const constructor: BlockToolConstructable = ListTool;
  expect(Object.getPrototypeOf(constructor.prototype)).toBe(List.prototype);
  expect(ListTool.prototype.render).toBe(List.prototype.render);
  expect(ListTool.isReadOnlySupported).toBe(true);
});
it('omits only undefined optional ordered counters without mutating upstream output or filling defaults', () => {
  const data = {
    style: 'ordered' as const,
    meta: { start: undefined, counterType: undefined },
    items: [],
  };
  vi.spyOn(List.prototype, 'save').mockReturnValue(data);
  const owner = Object.create(ListTool.prototype) as ListTool;
  const saved = owner.save();
  expect(saved).toEqual({ style: 'ordered', meta: {}, items: [] });
  expect(saved.items).toBe(data.items);
  expect(data.meta).toHaveProperty('start', undefined);
  expect(data.meta).toHaveProperty('counterType', undefined);
  expect(validateListData(saved)).toEqual({ ok: true });
  expect(validateListData(data).ok).toBe(false);
});
it('preserves explicit counters and leaves other invalid values for structural validation', () => {
  const data = {
    style: 'ordered' as const,
    meta: { start: 3, counterType: 'upper-roman' as const, extra: undefined },
    items: [],
  };
  vi.spyOn(List.prototype, 'save').mockReturnValue(data);
  const saved = (Object.create(ListTool.prototype) as ListTool).save();
  expect(saved.meta).toEqual(data.meta);
  expect(validateListData(saved).ok).toBe(false);
});
it('does not rewrite unordered or checklist output', () => {
  const data = {
    style: 'checklist' as const,
    meta: {},
    items: [{ content: 'Done', meta: { checked: true }, items: [] }],
  };
  vi.spyOn(List.prototype, 'save').mockReturnValue(data);
  expect((Object.create(ListTool.prototype) as ListTool).save()).toBe(data);
});

it('characterizes upstream rejection of persisted zero-item lists separately from structural validity', () => {
  const data = { style: 'unordered', meta: {}, items: [] };
  expect(validateListData(data)).toEqual({ ok: true });
  // Normalization fails before API/DOM use; this is not an editor simulation.
  expect(() =>
    Reflect.construct(ListTool, [
      { data, config: {}, api: {}, block: {}, readOnly: false },
    ]),
  ).toThrow(/'text' in undefined/);
});
