// @vitest-environment jsdom
import '@angular/compiler';
import { ErrorHandler, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type {
  EditorJsErrorEvent,
  EditorJsChangeEvent,
  OutputData,
} from '@anarchitects/editorjs-core';
import type {
  EditorJsCreateOptions,
  EditorJsFactory,
  EditorJsInstance,
  EditorJsLoader,
} from '../src/index.js';

// Test ngc output: Vite alone does not compile Angular signal input/query metadata.
const artifact = resolve(
  import.meta.dirname,
  '../../../../dist/packages/editorjs/angular/fesm2022/anarchitects-editorjs-angular.mjs',
);
const { EditorJs, EDITOR_JS_LOADER, EditorJsOperationError } = createRequire(
  import.meta.url,
)(artifact) as typeof import('../src/index.js');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function instance(isReady = Promise.resolve()): EditorJsInstance {
  return {
    isReady,
    destroy: vi.fn(),
    save: vi.fn(async () => ({ blocks: [] })),
    render: vi.fn(async () => undefined),
    clear: vi.fn(),
    focus: vi.fn(() => true),
    readOnly: { toggle: vi.fn(async (value) => value) },
  };
}

function setup(loader: EditorJsLoader, platform = 'browser') {
  const handleError = vi.fn();
  TestBed.configureTestingModule({
    imports: [EditorJs],
    providers: [
      { provide: EDITOR_JS_LOADER, useValue: loader },
      { provide: PLATFORM_ID, useValue: platform },
      { provide: ErrorHandler, useValue: { handleError } },
    ],
  });
  return handleError;
}

function mount() {
  const fixture = TestBed.createComponent(EditorJs);
  const ready = vi.fn();
  const errors: EditorJsErrorEvent[] = [];
  const changes: EditorJsChangeEvent[] = [];
  fixture.componentInstance.ready.subscribe(ready);
  fixture.componentInstance.error.subscribe((event) => errors.push(event));
  fixture.componentInstance.change.subscribe((event) => changes.push(event));
  return { fixture, ready, errors, changes };
}

beforeAll(() =>
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()),
);
afterEach(() => TestBed.resetTestingModule());

describe('standalone EditorJs ownership', () => {
  it('creates once after rendering, detaches core data and emits only after readiness', async () => {
    const readiness = deferred<void>();
    const editor = instance(readiness.promise);
    const create = vi.fn((_options: EditorJsCreateOptions) => editor);
    const loader = vi.fn(async () => create);
    setup(loader);
    const { fixture, ready, errors } = mount();
    const data: OutputData = {
      blocks: [{ type: 'custom', data: { nested: { value: 1 } } }],
    };
    fixture.componentRef.setInput('data', data);
    fixture.componentRef.setInput('config', { placeholder: 'Write' });
    expect(loader).not.toHaveBeenCalled();
    await fixture.whenStable();
    expect(create).toHaveBeenCalledOnce();
    const options = create.mock.calls[0][0] as EditorJsCreateOptions;
    expect(options.holder).toBe(fixture.nativeElement.firstElementChild);
    expect(options.holder).toBeInstanceOf(HTMLElement);
    expect(options.config).toEqual({ placeholder: 'Write' });
    expect(options.data).toEqual(data);
    expect(options.data?.blocks[0].data).not.toBe(data.blocks[0].data);
    expect(ready).not.toHaveBeenCalled();
    readiness.resolve();
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    expect(ready).toHaveBeenCalledWith(undefined);
    await fixture.whenStable();
    expect(create).toHaveBeenCalledOnce();
    expect(errors).toEqual([]);
    fixture.destroy();
    expect(editor.destroy).toHaveBeenCalledOnce();
  });

  it('uses the latest initial data while loading and keeps two owners independent', async () => {
    const loading = deferred<EditorJsFactory>();
    const editors: EditorJsInstance[] = [];
    const create = vi.fn((_options: EditorJsCreateOptions) => {
      const editor = instance();
      editors.push(editor);
      return editor;
    });
    setup(() => loading.promise);
    const first = mount();
    const second = mount();
    await first.fixture.whenStable();
    await second.fixture.whenStable();
    const latest: OutputData = {
      blocks: [{ type: 'paragraph', data: { text: 'Latest' } }],
    };
    first.fixture.componentRef.setInput('data', latest);
    loading.resolve(create);
    await vi.waitFor(() => expect(first.ready).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(second.ready).toHaveBeenCalledOnce());
    expect(create.mock.calls[0][0].data).toEqual(latest);
    expect(create.mock.calls[1][0].data).toEqual({ blocks: [] });
    expect(create.mock.calls[0][0].holder).not.toBe(
      create.mock.calls[1][0].holder,
    );
    first.fixture.destroy();
    expect(editors[0].destroy).toHaveBeenCalledOnce();
    expect(editors[1].destroy).not.toHaveBeenCalled();
    second.fixture.destroy();
    expect(editors[1].destroy).toHaveBeenCalledOnce();
  });

  it('does not load when destroyed before the first render', async () => {
    const loader = vi.fn(async () => () => instance());
    setup(loader);
    const { fixture } = mount();
    fixture.destroy();
    await fixture.whenStable();
    expect(loader).not.toHaveBeenCalled();
  });

  it('does not create an orphan when destroyed while loading', async () => {
    const loading = deferred<() => EditorJsInstance>();
    const create = vi.fn(() => instance());
    setup(() => loading.promise);
    const { fixture, ready, errors } = mount();
    await fixture.whenStable();
    fixture.destroy();
    loading.resolve(create);
    await loading.promise;
    await Promise.resolve();
    expect(create).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
    expect(errors).toEqual([]);
  });

  it('ignores a rejected import after destruction and allows a fresh owner to initialize', async () => {
    const loading = deferred<EditorJsFactory>();
    const editor = instance();
    const loader = vi
      .fn<EditorJsLoader>()
      .mockReturnValueOnce(loading.promise)
      .mockResolvedValue(() => editor);
    const handleError = setup(loader);
    const first = mount();
    await first.fixture.whenStable();
    first.fixture.destroy();
    loading.reject(new Error('Late import rejection'));
    const second = mount();
    await second.fixture.whenStable();
    await vi.waitFor(() => expect(second.ready).toHaveBeenCalledOnce());
    expect(first.ready).not.toHaveBeenCalled();
    expect(first.errors).toEqual([]);
    expect(first.changes).toEqual([]);
    expect(handleError).not.toHaveBeenCalled();
    expect(loader).toHaveBeenCalledTimes(2);
    second.fixture.destroy();
    expect(editor.destroy).toHaveBeenCalledOnce();
  });

  it.each(['resolve', 'reject'] as const)(
    'disposes a pending instance after readiness %s without late events',
    async (settlement) => {
      const readiness = deferred<void>();
      const editor = instance(readiness.promise);
      setup(async () => () => editor);
      const { fixture, ready, errors } = mount();
      await fixture.whenStable();
      fixture.destroy();
      expect(editor.destroy).not.toHaveBeenCalled();
      if (settlement === 'resolve') readiness.resolve();
      else readiness.reject(new Error('Not ready'));
      await vi.waitFor(() => expect(editor.destroy).toHaveBeenCalledOnce());
      expect(ready).not.toHaveBeenCalled();
      expect(errors).toEqual([]);
    },
  );

  it.each(['load', 'create', 'ready'] as const)(
    'reports a %s failure without emitting readiness',
    async (operation) => {
      const failure = new Error(operation);
      const readiness = deferred<void>();
      const editor = instance(readiness.promise);
      setup(async () => {
        if (operation === 'load') throw failure;
        return () => {
          if (operation === 'create') throw failure;
          return editor;
        };
      });
      const { fixture, ready, errors } = mount();
      await fixture.whenStable();
      if (operation === 'ready') readiness.reject(failure);
      await vi.waitFor(() =>
        expect(errors).toEqual([
          { operation, code: 'operation-failed', cause: failure },
        ]),
      );
      expect(ready).not.toHaveBeenCalled();
      expect(editor.destroy).toHaveBeenCalledTimes(
        operation === 'ready' ? 1 : 0,
      );
      fixture.destroy();
      expect(editor.destroy).toHaveBeenCalledTimes(
        operation === 'ready' ? 1 : 0,
      );
    },
  );

  it('reports core diagnostics and does not create for invalid initial data', async () => {
    const create = vi.fn(() => instance());
    setup(async () => create);
    const { fixture, errors } = mount();
    fixture.componentRef.setInput('data', { blocks: [{ type: '', data: {} }] });
    await fixture.whenStable();
    expect(errors).toMatchObject([
      {
        operation: 'data',
        code: 'invalid-data',
        cause: { code: 'invalid_type', path: ['blocks', 0, 'type'] },
      },
    ]);
    expect(create).not.toHaveBeenCalled();
  });

  it('routes disposal failures to Angular ErrorHandler after outputs are destroyed', async () => {
    const failure = new Error('Cannot dispose');
    const editor = instance();
    vi.mocked(editor.destroy).mockImplementation(() => {
      throw failure;
    });
    const handleError = setup(async () => () => editor);
    const { fixture, ready, errors } = mount();
    await fixture.whenStable();
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    fixture.destroy();
    expect(handleError).toHaveBeenCalledWith(failure);
    expect(errors).toEqual([]);
  });

  it('never invokes even an overridden loader on the server platform', async () => {
    const loader = vi.fn(async () => () => instance());
    setup(loader, 'server');
    const { fixture, ready } = mount();
    await fixture.whenStable();
    expect(loader).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
  });

  it('mounts editable paragraphs with the real Editor.js runtime and keeps the second editor after disposal', async () => {
    // jsdom supplies DOM behavior; only its missing media-query API is stubbed.
    // This is a runtime integration check, not a real-browser compatibility claim.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: () => true,
    }));
    try {
      TestBed.configureTestingModule({ imports: [EditorJs] });
      const first = mount();
      const second = mount();
      first.fixture.componentRef.setInput('data', {
        blocks: [{ type: 'paragraph', data: { text: 'First' } }],
      });
      second.fixture.componentRef.setInput('data', {
        blocks: [{ type: 'paragraph', data: { text: 'Second' } }],
      });
      await first.fixture.whenStable();
      await second.fixture.whenStable();
      await vi.waitFor(() => expect(first.ready).toHaveBeenCalledOnce());
      await vi.waitFor(() => expect(second.ready).toHaveBeenCalledOnce());
      const paragraph = second.fixture.nativeElement.querySelector(
        '.ce-paragraph',
      ) as HTMLElement;
      expect(paragraph.contentEditable).toBe('true');
      expect(paragraph.textContent).toBe('Second');
      first.fixture.destroy();
      expect(second.fixture.nativeElement.contains(paragraph)).toBe(true);
      paragraph.textContent = 'Edited';
      paragraph.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: 'Edited' }),
      );
      expect(paragraph.textContent).toBe('Edited');
      await vi.waitFor(() => expect(second.changes).toHaveLength(1));
      expect(second.changes[0].data.blocks[0].data).toMatchObject({
        text: 'Edited',
      });
      second.fixture.componentRef.setInput('data', {
        blocks: [{ type: 'paragraph', data: { text: 'Replacement' } }],
      });
      await second.fixture.whenStable();
      await vi.waitFor(() =>
        expect(
          second.fixture.nativeElement.querySelector('.ce-paragraph')
            ?.textContent,
        ).toBe('Replacement'),
      );
      // Let Editor.js's batched mutation callback run, if one was pending.
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(second.changes).toHaveLength(1);
      const controls = second.fixture.componentInstance.api;
      expect((await controls.save()).blocks[0].data).toMatchObject({
        text: 'Replacement',
      });
      expect(await controls.setReadOnly(true)).toBe(true);
      expect(
        second.fixture.nativeElement.querySelector('.ce-paragraph')
          ?.contentEditable,
      ).toBe('false');
      expect(await controls.setReadOnly(false)).toBe(false);
      await controls.clear();
      expect((await controls.save()).blocks).toEqual([]);
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(second.changes).toHaveLength(1);
      expect(first.errors).toEqual([]);
      expect(second.errors).toEqual([]);
      second.fixture.destroy();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('document inputs and saved changes', () => {
  const document = (text: string): OutputData => ({
    blocks: [{ type: 'custom', data: { text } }],
  });
  function controlled(readiness = Promise.resolve()) {
    const editor = instance(readiness);
    let options!: EditorJsCreateOptions;
    let content: OutputData;
    vi.mocked(editor.save).mockImplementation(async () => content);
    vi.mocked(editor.render).mockImplementation(async (data) => {
      content = data;
      options.onChange();
    });
    const create = vi.fn((value: EditorJsCreateOptions) => {
      options = value;
      content = value.data!;
      return editor;
    });
    setup(async () => create);
    const owner = mount();
    return {
      ...owner,
      editor,
      create,
      notify: () => options.onChange(),
      edit: (data: OutputData) => {
        content = data;
        options.onChange();
      },
    };
  }

  it('emits core snapshots and applies replacement/clear without feedback or host mutation', async () => {
    const owner = controlled();
    const input = document('Initial');
    owner.fixture.componentRef.setInput('data', input);
    await owner.fixture.whenStable();
    await vi.waitFor(() => expect(owner.ready).toHaveBeenCalledOnce());
    owner.edit(document('Edited'));
    await vi.waitFor(() =>
      expect(owner.changes).toEqual([
        { sequence: 1, data: document('Edited') },
      ]),
    );
    expect(input).toEqual(document('Initial'));
    const replacement = document('External');
    owner.fixture.componentRef.setInput('data', replacement);
    await owner.fixture.whenStable();
    await vi.waitFor(() =>
      expect(owner.editor.render).toHaveBeenCalledWith(replacement),
    );
    expect(vi.mocked(owner.editor.render).mock.calls[0][0]).not.toBe(
      replacement,
    );
    owner.notify();
    await vi.waitFor(() => expect(owner.editor.save).toHaveBeenCalledTimes(3));
    expect(owner.changes).toHaveLength(1);
    owner.fixture.componentRef.setInput('data', undefined);
    await owner.fixture.whenStable();
    await vi.waitFor(() =>
      expect(owner.editor.render).toHaveBeenLastCalledWith({ blocks: [] }),
    );
    expect(owner.changes).toHaveLength(1);
    expect(owner.errors).toEqual([]);
  });

  it('queues data arriving during readiness and reports config changes without recreation', async () => {
    const readiness = deferred<void>();
    const owner = controlled(readiness.promise);
    const initialConfig = { placeholder: 'Initial' };
    owner.fixture.componentRef.setInput('config', initialConfig);
    owner.fixture.componentRef.setInput('data', document('Initial'));
    await owner.fixture.whenStable();
    owner.fixture.componentRef.setInput('data', document('Before ready'));
    owner.fixture.componentRef.setInput('config', {
      placeholder: 'Unsupported update',
    });
    await owner.fixture.whenStable();
    expect(owner.editor.render).not.toHaveBeenCalled();
    expect(owner.errors).toMatchObject([
      { operation: 'config', code: 'config-changed' },
    ]);
    expect(owner.create.mock.calls[0][0].config).toBe(initialConfig);
    readiness.resolve();
    await vi.waitFor(() =>
      expect(owner.editor.render).toHaveBeenCalledWith(
        document('Before ready'),
      ),
    );
    expect(owner.ready).toHaveBeenCalledOnce();
    expect(owner.create).toHaveBeenCalledOnce();
    expect(owner.changes).toEqual([]);
  });

  it('rejects invalid replacement, observes input identity and recovers on a new valid reference', async () => {
    const owner = controlled();
    const initial = document('Initial');
    owner.fixture.componentRef.setInput('data', initial);
    await owner.fixture.whenStable();
    initial.blocks.length = 0;
    owner.fixture.componentRef.setInput('data', initial);
    await owner.fixture.whenStable();
    expect(owner.editor.render).not.toHaveBeenCalled();
    owner.fixture.componentRef.setInput('data', null);
    await owner.fixture.whenStable();
    expect(owner.errors).toMatchObject([
      { operation: 'data', code: 'invalid-data' },
    ]);
    expect(owner.editor.render).not.toHaveBeenCalled();
    owner.fixture.componentRef.setInput('data', document('Recovered'));
    await owner.fixture.whenStable();
    await vi.waitFor(() =>
      expect(owner.editor.render).toHaveBeenCalledWith(document('Recovered')),
    );
    expect(owner.changes).toEqual([]);
  });

  it('suppresses stale saves through the core and emits only the latest snapshot', async () => {
    const owner = controlled();
    const saving = deferred<OutputData>();
    vi.mocked(owner.editor.save).mockReturnValueOnce(saving.promise);
    await owner.fixture.whenStable();
    owner.edit(document('Old'));
    await vi.waitFor(() => expect(owner.editor.save).toHaveBeenCalledOnce());
    owner.edit(document('Latest'));
    saving.resolve(document('Old'));
    await vi.waitFor(() =>
      expect(owner.changes).toEqual([
        { sequence: 2, data: document('Latest') },
      ]),
    );
  });

  it('surfaces save/render failures through the shared error channel and remains usable', async () => {
    const owner = controlled();
    const failure = new Error('Save failed');
    vi.mocked(owner.editor.save).mockRejectedValueOnce(failure);
    await owner.fixture.whenStable();
    owner.edit(document('Edit'));
    await vi.waitFor(() =>
      expect(owner.errors).toEqual([
        { operation: 'save', code: 'operation-failed', cause: failure },
      ]),
    );
    const renderFailure = new Error('Render failed');
    vi.mocked(owner.editor.render).mockRejectedValueOnce(renderFailure);
    owner.fixture.componentRef.setInput('data', document('Failed'));
    await owner.fixture.whenStable();
    await vi.waitFor(() =>
      expect(owner.errors[1]).toEqual({
        operation: 'render',
        code: 'operation-failed',
        cause: renderFailure,
      }),
    );
    owner.fixture.componentRef.setInput('data', document('Recovered'));
    await owner.fixture.whenStable();
    await vi.waitFor(() => expect(owner.editor.save).toHaveBeenCalledTimes(2));
    owner.edit(document('Final'));
    await vi.waitFor(() =>
      expect(owner.changes).toEqual([{ sequence: 2, data: document('Final') }]),
    );
  });

  it.each(['save', 'render'] as const)(
    'prevents late output and queued replacements after destruction during %s',
    async (operation) => {
      const owner = controlled();
      const pending = deferred<never>();
      if (operation === 'save')
        vi.mocked(owner.editor.save).mockReturnValueOnce(pending.promise);
      else vi.mocked(owner.editor.render).mockReturnValueOnce(pending.promise);
      await owner.fixture.whenStable();
      if (operation === 'save') owner.edit(document('Edit'));
      else owner.fixture.componentRef.setInput('data', document('Pending'));
      await owner.fixture.whenStable();
      await vi.waitFor(() =>
        expect(owner.editor[operation]).toHaveBeenCalledOnce(),
      );
      owner.fixture.componentRef.setInput('data', document('Queued'));
      await owner.fixture.whenStable();
      owner.fixture.destroy();
      pending.reject(new Error('Late'));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(owner.changes).toEqual([]);
      expect(owner.errors).toEqual([]);
      expect(owner.editor.destroy).toHaveBeenCalledOnce();
      expect(owner.editor.render).toHaveBeenCalledTimes(
        operation === 'render' ? 1 : 0,
      );
    },
  );
});

describe('component imperative facade', () => {
  it('keeps a stable facade from construction through readiness and delegates every operation', async () => {
    const readiness = deferred<void>();
    const editor = instance(readiness.promise);
    let options!: EditorJsCreateOptions;
    let data: OutputData = { blocks: [] };
    vi.mocked(editor.render).mockImplementation(async (value) => {
      data = value;
      options.onChange();
    });
    vi.mocked(editor.clear).mockImplementation(() => {
      data = { blocks: [] };
      options.onChange();
    });
    vi.mocked(editor.save).mockImplementation(async () => data);
    setup(async () => (value) => {
      options = value;
      return editor;
    });
    const owner = mount();
    const api = owner.fixture.componentInstance.api;
    const beforeReady = await api.save().catch((error: unknown) => error);
    expect(beforeReady).toBeInstanceOf(EditorJsOperationError);
    expect(beforeReady).toMatchObject({ operation: 'save', code: 'not-ready' });
    expect(owner.errors[0]).toBe(beforeReady);
    await owner.fixture.whenStable();
    readiness.resolve();
    await vi.waitFor(() => expect(owner.ready).toHaveBeenCalledOnce());
    expect(owner.ready).toHaveBeenCalledWith(undefined);
    expect(owner.fixture.componentInstance.api).toBe(api);
    const input: OutputData = {
      blocks: [{ type: 'custom', data: { value: 1 } }],
    };
    await api.render(input);
    expect(await api.save()).toEqual(input);
    expect(vi.mocked(editor.render).mock.calls[0][0]).not.toBe(input);
    expect(await api.focus(true)).toBe(true);
    expect(editor.focus).toHaveBeenCalledWith(true);
    expect(await api.setReadOnly(true)).toBe(true);
    expect(editor.readOnly.toggle).toHaveBeenCalledWith(true);
    await api.clear();
    expect(await api.save()).toEqual({ blocks: [] });
    expect(owner.changes).toEqual([]);
    owner.fixture.destroy();
    await expect(api.focus()).rejects.toMatchObject({ code: 'destroyed' });
    expect(owner.errors).toHaveLength(1);
  });

  it('rejects active and queued calls immediately when the Angular owner is destroyed', async () => {
    const editor = instance();
    const saving = deferred<OutputData>();
    vi.mocked(editor.save).mockReturnValueOnce(saving.promise);
    setup(async () => () => editor);
    const owner = mount();
    await owner.fixture.whenStable();
    const api = owner.fixture.componentInstance.api;
    const active = api.save().catch((error: unknown) => error);
    const queued = api.setReadOnly(true).catch((error: unknown) => error);
    await vi.waitFor(() => expect(editor.save).toHaveBeenCalledOnce());
    owner.fixture.destroy();
    expect(await active).toMatchObject({
      code: 'destroyed',
      operation: 'save',
    });
    expect(await queued).toMatchObject({
      code: 'destroyed',
      operation: 'readOnly',
    });
    expect(editor.destroy).toHaveBeenCalledOnce();
    saving.reject(new Error('Late rejection'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(editor.readOnly.toggle).not.toHaveBeenCalled();
    expect(owner.changes).toEqual([]);
    expect(owner.errors).toEqual([]);
  });

  it('reports an unsupported read-only transition to the promise and output, then accepts later commands', async () => {
    const editor = instance();
    const cause = new Error('Tool does not support read-only');
    vi.mocked(editor.readOnly.toggle).mockRejectedValueOnce(cause);
    setup(async () => () => editor);
    const owner = mount();
    await owner.fixture.whenStable();
    const api = owner.fixture.componentInstance.api;
    const failure = await api
      .setReadOnly(true)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(EditorJsOperationError);
    expect(failure).toMatchObject({
      operation: 'readOnly',
      code: 'operation-failed',
      cause,
    });
    expect(owner.errors[0]).toBe(failure);
    await expect(api.render({ blocks: [] })).resolves.toBeUndefined();
    expect(owner.changes).toEqual([]);
  });

  it('binds controls to each component without shared mutable editor state', async () => {
    const editors: EditorJsInstance[] = [];
    setup(async () => (options) => {
      const editor = instance();
      vi.mocked(editor.save).mockResolvedValue(options.data!);
      editors.push(editor);
      return editor;
    });
    const first = mount();
    const second = mount();
    first.fixture.componentRef.setInput('data', {
      blocks: [{ type: 'paragraph', data: { text: 'First' } }],
    });
    second.fixture.componentRef.setInput('data', {
      blocks: [{ type: 'paragraph', data: { text: 'Second' } }],
    });
    await first.fixture.whenStable();
    await second.fixture.whenStable();
    const one = first.fixture.componentInstance.api;
    const two = second.fixture.componentInstance.api;
    expect(one).not.toBe(two);
    expect((await one.save()).blocks[0].data).toEqual({ text: 'First' });
    first.fixture.destroy();
    expect((await two.save()).blocks[0].data).toEqual({ text: 'Second' });
    await two.focus();
    expect(editors[0].focus).not.toHaveBeenCalled();
    expect(editors[1].focus).toHaveBeenCalledOnce();
  });
});
