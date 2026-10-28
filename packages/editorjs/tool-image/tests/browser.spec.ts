// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import type { API, BlockAPI, PasteEvent } from '@editorjs/editorjs';
import { ImageTool } from '../src/browser.js';
import type { ImageConfig, ImageData } from '../src/index.js';
const base = {
  file: { url: 'asset.svg', id: 'initial' },
  caption: 'Caption',
  withBorder: false,
  withBackground: false,
  stretched: false,
};
const owners: ImageTool[] = [];
afterEach(() => {
  owners.forEach((tool) => tool.destroy());
  owners.length = 0;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function setup(
  config: ImageConfig<Blob>,
  data: Partial<ImageData> = base,
  readOnly = false,
) {
  const show = vi.fn();
  const dispatchChange = vi.fn();
  const api = {
    styles: {
      block: 'block',
      loader: 'loader',
      input: 'input',
      button: 'button',
    },
    i18n: { t: (text: string) => text },
    notifier: { show },
  } as unknown as API;
  const block = { dispatchChange, stretched: false } as unknown as BlockAPI;
  const tool = new ImageTool({ data, config, api, block, readOnly });
  owners.push(tool);
  const root = tool.render();
  document.body.append(root);
  return { tool, root, show, dispatchChange };
}
const success = () => ({
  success: 1 as const,
  file: { url: 'local.svg', id: 'host', meta: { width: 20 } },
});
const uploader = () => ({
  async uploadByFile() {
    return success();
  },
  async uploadByUrl() {
    return success();
  },
});
const paste = (url = 'asset.svg') =>
  new CustomEvent('pattern', {
    detail: { data: url, key: 'image' },
  }) as PasteEvent;
it('authors independent description/decorative/unset states and preserves file metadata', async () => {
  const { tool, root, dispatchChange } = setup({ uploader: uploader() });
  const mode = root.querySelector('select');
  const text = root.querySelector('textarea');
  if (!mode || !text) throw new Error('Missing controls');
  expect(mode.value).toBe('unset');
  expect(text.disabled).toBe(true);
  mode.value = 'description';
  mode.dispatchEvent(new Event('change'));
  text.value = 'Red <square>';
  text.dispatchEvent(new Event('input'));
  await tool.onPaste(paste());
  await vi.waitFor(() => expect(tool.save().file['id']).toBe('host'));
  expect(tool.save()).toMatchObject({
    alt: 'Red <square>',
    caption: 'Caption',
    file: success().file,
  });
  expect(root.querySelector('img')?.alt).toBe('Red <square>');
  expect(dispatchChange).toHaveBeenCalled();
  mode.value = 'decorative';
  mode.dispatchEvent(new Event('change'));
  expect(tool.save().alt).toBe('');
  mode.value = 'unset';
  mode.dispatchEvent(new Event('change'));
  expect(tool.save()).not.toHaveProperty('alt');
});
it('round trips, isolates controls and disables all owned edits in read only', () => {
  const { tool, root } = setup(
    { uploader: uploader() },
    { ...base, alt: 'Saved' },
    true,
  );
  expect(root.querySelector('textarea')?.value).toBe('Saved');
  expect(root.querySelector('textarea')?.disabled).toBe(true);
  expect(root.querySelector('select')?.disabled).toBe(true);
  expect(tool.renderSettings()).toEqual([]);
  expect(tool.save().alt).toBe('Saved');
  const other = setup({ uploader: uploader() }, { ...base, alt: '' });
  expect(other.tool.save().alt).toBe('');
});
it('preserves uploader receiver and actual File and Blob inputs', async () => {
  const seen: Blob[] = [];
  const host = {
    marker: 'receiver',
    async uploadByFile(input: Blob) {
      expect(this.marker).toBe('receiver');
      seen.push(input);
      return success();
    },
    async uploadByUrl(url: string) {
      expect(this.marker).toBe('receiver');
      expect(url).toBe('asset.svg');
      return success();
    },
  };
  const { tool } = setup({ uploader: host });
  for (const file of [
    new File(['asset'], 'asset.svg', { type: 'image/svg+xml' }),
    new Blob(['asset'], { type: 'image/svg+xml' }),
  ])
    await tool.onPaste(
      new CustomEvent('file', { detail: { file } }) as PasteEvent,
    );
  await tool.onPaste(paste());
  await vi.waitFor(() => expect(seen.length).toBe(2));
  expect(seen[0]).toBeInstanceOf(File);
  expect(seen[1]).not.toBeInstanceOf(File);
});
it.each(['zero', 'throw', 'reject', 'malformed', 'cyclic', 'blank'])(
  'routes %s failures to the upstream notifier',
  async (kind) => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const host = uploader();
    const cause = { code: 'denied' };
    const operation = () => {
      if (kind === 'throw') throw cause;
      if (kind === 'reject') return Promise.reject(cause);
      if (kind === 'zero') return Promise.resolve({ success: 0, error: cause });
      if (kind === 'blank')
        return Promise.resolve({ success: 1, file: { url: ' ' } });
      if (kind === 'cyclic') {
        const file: Record<string, unknown> = { url: 'x' };
        file['cycle'] = file;
        return Promise.resolve({ success: 1, file });
      }
      return Promise.resolve({ success: true, file: { url: 'x' } });
    };
    host.uploadByUrl = operation as typeof host.uploadByUrl;
    const { tool, show } = setup({ uploader: host });
    await tool.onPaste(paste());
    await vi.waitFor(() => expect(show).toHaveBeenCalledOnce());
    expect(tool.save().file['id']).toBe('initial');
    if (kind === 'zero') {
      const error = vi.mocked(console.log).mock.calls[0][1] as Error;
      expect(error.cause).toBe(cause);
    }
  },
);
it.each([false, true])(
  'settles pending work after removal without notifications or cross-owner mutation (reject=%s)',
  async (reject) => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    let resolve!: (value: ReturnType<typeof success>) => void;
    let fail!: (reason: unknown) => void;
    const host = uploader();
    host.uploadByUrl = () =>
      new Promise((yes, no) => {
        resolve = yes;
        fail = no;
      });
    const first = setup({ uploader: host }, { ...base, alt: 'Removed' });
    const second = setup({ uploader: uploader() }, { ...base, alt: 'Live' });
    await first.tool.onPaste(paste());
    first.tool.removed();
    first.root.remove();
    if (reject) fail(new Error('late'));
    else resolve(success());
    await vi.waitFor(() => {
      if (reject) expect(console.log).toHaveBeenCalled();
      else expect(first.tool.save().file['id']).toBe('host');
    });
    expect(first.show).not.toHaveBeenCalled();
    expect(document.body.contains(first.root)).toBe(false);
    expect(second.tool.save()).toMatchObject({
      alt: 'Live',
      file: { id: 'initial' },
    });
  },
);

it.each([false, true])(
  'a late FileReader preview cannot replace the settled live view (failure=%s)',
  async (failure) => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const readers: FileReader[] = [];
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(
      function (this: FileReader) {
        readers.push(this);
      },
    );
    const host = uploader();
    if (failure) host.uploadByFile = () => Promise.reject(new Error('failed'));
    const { tool, root } = setup(
      { uploader: host },
      { ...base, alt: 'Keep alt' },
    );
    const oldView = root.firstElementChild;
    await tool.onPaste(
      new CustomEvent('file', {
        detail: { file: new File(['x'], 'x.svg') },
      }) as PasteEvent,
    );
    await vi.waitFor(() => expect(root.firstElementChild).not.toBe(oldView));
    expect(tool.save().file['id']).toBe(failure ? 'initial' : 'host');
    const currentView = root.firstElementChild;
    expect(currentView).not.toBe(oldView);
    for (const reader of readers) {
      Object.defineProperty(reader, 'result', {
        value: 'data:image/svg+xml,preview',
      });
      reader.dispatchEvent(new ProgressEvent('load'));
    }
    expect(root.firstElementChild).toBe(currentView);
    expect(tool.save().alt).toBe('Keep alt');
    expect(oldView?.isConnected).toBe(false);
  },
);

it('keeps native editing keys local and releases its control listeners on removal', () => {
  const { tool, root, dispatchChange } = setup({ uploader: uploader() });
  const select = root.querySelector('select');
  const description = root.querySelector('textarea');
  if (!select || !description) throw new Error('Missing controls');
  const bubbled = vi.fn();
  root.addEventListener('keydown', bubbled);
  description.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
  );
  expect(bubbled).not.toHaveBeenCalled();
  tool.removed();
  select.value = 'decorative';
  select.dispatchEvent(new Event('change'));
  expect(dispatchChange).not.toHaveBeenCalled();
  expect(tool.save()).not.toHaveProperty('alt');
});
