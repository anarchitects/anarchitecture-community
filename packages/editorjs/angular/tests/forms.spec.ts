// @vitest-environment jsdom
import '@angular/compiler';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type {
  EditorJsChangeEvent,
  EditorJsErrorEvent,
  OutputData,
} from '@anarchitects/editorjs-core';
import type {
  EditorJsCreateOptions,
  EditorJsFactory,
  EditorJsInstance,
  EditorJsLoader,
} from '../src/index.js';

const require = createRequire(import.meta.url);
const artifacts = resolve(
  import.meta.dirname,
  '../../../../dist/packages/editorjs/angular/fesm2022',
);
const { EDITOR_JS_LOADER } = require(
  resolve(artifacts, 'anarchitects-editorjs-angular.mjs'),
) as typeof import('../src/index.js');
const { EditorJsControl } = require(
  resolve(artifacts, 'anarchitects-editorjs-angular-forms.mjs'),
) as typeof import('../forms/src/index.js');

function document(text: string): OutputData {
  return { blocks: [{ type: 'paragraph', data: { text } }] };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function rawEditor(
  options: EditorJsCreateOptions,
  isReady = Promise.resolve(),
) {
  if (!options.data) throw new Error('Expected an initial document');
  let data = options.data;
  const editor: EditorJsInstance = {
    isReady,
    destroy: vi.fn(),
    clear: vi.fn(),
    focus: vi.fn(() => true),
    save: vi.fn(async () => data),
    render: vi.fn(async (next) => {
      data = next;
      options.onChange();
    }),
    readOnly: { toggle: vi.fn(async (value) => value) },
  };
  return {
    editor,
    options,
    edit(next: OutputData) {
      data = next;
      options.onChange();
    },
  };
}

@Component({
  selector: 'aa-forms-test-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditorJsControl, FormField],
  template: `
    @if (visible()) {
      <aa-editorjs-control
        [formField]="fields.body"
        (ready)="ready()"
        (change)="changes.push($event)"
        (error)="errors.push($event)"
      />
    }
  `,
})
class FormsHost {
  readonly model = signal<{ body: OutputData }>({ body: document('Initial') });
  readonly fields = form(this.model);
  readonly visible = signal(true);
  readonly ready = vi.fn();
  readonly changes: EditorJsChangeEvent[] = [];
  readonly errors: EditorJsErrorEvent[] = [];
}

@Component({
  selector: 'aa-model-test-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditorJsControl],
  template: `<aa-editorjs-control
    [(value)]="value"
    (error)="errors.push($event)"
  />`,
})
class ModelHost {
  readonly value = signal<OutputData>(document('Model initial'));
  readonly errors: EditorJsErrorEvent[] = [];
}

function setup(loader?: EditorJsLoader, readiness?: Promise<void>) {
  const created: ReturnType<typeof rawEditor>[] = [];
  const create: EditorJsFactory = (options) => {
    const raw = rawEditor(options, readiness);
    created.push(raw);
    return raw.editor;
  };
  TestBed.configureTestingModule({
    imports: [FormsHost],
    providers: [
      { provide: EDITOR_JS_LOADER, useValue: loader ?? (async () => create) },
    ],
  });
  const fixture = TestBed.createComponent(FormsHost);
  return { fixture, host: fixture.componentInstance, created, create };
}

beforeAll(() =>
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()),
);
afterEach(() => TestBed.resetTestingModule());

describe('native Signal Forms value binding', () => {
  it('initializes a detached document and publishes edits once without rendering the echo', async () => {
    const { fixture, host, created } = setup();
    const initial = host.model().body;
    await fixture.whenStable();
    await vi.waitFor(() => expect(host.ready).toHaveBeenCalledOnce());
    const raw = created[0];
    expect(raw.options.data).toEqual(document('Initial'));
    expect(raw.options.data).not.toBe(initial);
    expect(raw.options.data?.blocks[0].data).not.toBe(initial.blocks[0].data);
    expect(host.fields.body().dirty()).toBe(false);
    expect(host.fields.body().touched()).toBe(false);
    const edited = document('Edited');
    raw.edit(edited);
    await vi.waitFor(() =>
      expect(host.model().body.blocks[0].data).toEqual(edited.blocks[0].data),
    );
    await fixture.whenStable();
    expect(host.changes).toHaveLength(1);
    expect(host.changes[0].sequence).toBe(1);
    expect(host.fields.body().dirty()).toBe(true);
    expect(host.fields.body().touched()).toBe(false);
    expect(raw.editor.render).not.toHaveBeenCalled();
    expect(raw.editor.save).toHaveBeenCalledOnce();
    expect(host.model().body).not.toBe(edited);
    (edited.blocks[0].data as { text: string }).text = 'Mutated upstream';
    expect(host.model().body.blocks[0].data).toEqual({ text: 'Edited' });
    expect(host.changes[0].data).toEqual(document('Edited'));
    expect(host.changes[0].data).not.toBe(host.model().body);
    expect(
      Object.getOwnPropertySymbols(host.changes[0].data.blocks[0]),
    ).toEqual([]);
    expect(host.errors).toEqual([]);
  });

  it('renders the latest programmatic value silently and preserves interaction state', async () => {
    const { fixture, host, created } = setup();
    await fixture.whenStable();
    await vi.waitFor(() => expect(host.ready).toHaveBeenCalledOnce());
    host.model.set({ body: document('Superseded') });
    const latest = document('Latest');
    host.model.set({ body: latest });
    await fixture.whenStable();
    await vi.waitFor(() =>
      expect(created[0].editor.render).toHaveBeenCalledOnce(),
    );
    expect(created[0].editor.render).toHaveBeenCalledWith(document('Latest'));
    expect(vi.mocked(created[0].editor.render).mock.calls[0][0]).not.toBe(
      latest,
    );
    expect(host.changes).toEqual([]);
    expect(host.fields.body().dirty()).toBe(false);
    expect(host.fields.body().touched()).toBe(false);
    host.fields.body().markAsDirty();
    host.fields.body().markAsTouched();
    host.model.set({ body: document('Another') });
    await fixture.whenStable();
    await vi.waitFor(() =>
      expect(created[0].editor.render).toHaveBeenCalledTimes(2),
    );
    expect(host.fields.body().dirty()).toBe(true);
    expect(host.fields.body().touched()).toBe(true);
    expect(host.changes).toEqual([]);
  });

  it('accepts a previous published object as a new external write after another document', async () => {
    const { fixture, host, created } = setup();
    await fixture.whenStable();
    await vi.waitFor(() => expect(host.ready).toHaveBeenCalledOnce());
    created[0].edit(document('Published'));
    await vi.waitFor(() => expect(host.changes).toHaveLength(1));
    await fixture.whenStable();
    const published = host.model().body;
    host.model.set({ body: document('Replacement') });
    await fixture.whenStable();
    await vi.waitFor(() =>
      expect(created[0].editor.render).toHaveBeenCalledOnce(),
    );
    host.model.set({ body: published });
    await fixture.whenStable();
    await vi.waitFor(() =>
      expect(created[0].editor.render).toHaveBeenCalledTimes(2),
    );
    expect(created[0].editor.render).toHaveBeenLastCalledWith(
      document('Published'),
    );
    expect(host.changes).toHaveLength(1);
  });

  it('uses the latest value while the loader is pending', async () => {
    const loading = deferred<EditorJsFactory>();
    const { fixture, host, created, create } = setup(() => loading.promise);
    await fixture.whenStable();
    host.model.set({ body: document('While loading') });
    await fixture.whenStable();
    loading.resolve(create);
    await vi.waitFor(() => expect(host.ready).toHaveBeenCalledOnce());
    expect(created[0].options.data).toEqual(document('While loading'));
    expect(host.changes).toEqual([]);
    expect(host.fields.body().dirty()).toBe(false);
  });

  it('replaces data received while the raw instance is not ready', async () => {
    const readiness = deferred<void>();
    const { fixture, host, created } = setup(undefined, readiness.promise);
    await fixture.whenStable();
    expect(created).toHaveLength(1);
    host.model.set({ body: document('Before ready') });
    await fixture.whenStable();
    expect(created[0].editor.render).not.toHaveBeenCalled();
    readiness.resolve();
    await vi.waitFor(() =>
      expect(created[0].editor.render).toHaveBeenCalledWith(
        document('Before ready'),
      ),
    );
    expect(host.ready).toHaveBeenCalledOnce();
    expect(host.changes).toEqual([]);
    expect(host.fields.body().dirty()).toBe(false);
  });

  it.each([null, { blocks: 'invalid' }])(
    'rejects an invalid initial document (%j) without creating an editor',
    async (invalid) => {
      const { fixture, host, created } = setup();
      host.model.set({ body: invalid as unknown as OutputData });
      await fixture.whenStable();
      expect(host.model().body).toBe(invalid);
      expect(created).toHaveLength(0);
      expect(host.ready).not.toHaveBeenCalled();
      expect(host.errors).toMatchObject([
        { operation: 'data', code: 'invalid-data' },
      ]);
      host.model.set({ body: document('Corrected') });
      await fixture.whenStable();
      await vi.waitFor(() => expect(host.ready).toHaveBeenCalledOnce());
      expect(created[0].options.data).toEqual(document('Corrected'));
      expect(host.changes).toEqual([]);
      expect(host.fields.body().dirty()).toBe(false);
    },
  );

  it('retains invalid inbound state without replacing it with a late editor snapshot', async () => {
    const saving = deferred<OutputData>();
    const { fixture, host, created } = setup();
    await fixture.whenStable();
    await vi.waitFor(() => expect(host.ready).toHaveBeenCalledOnce());
    vi.mocked(created[0].editor.save).mockReturnValueOnce(saving.promise);
    created[0].edit(document('Draft'));
    await vi.waitFor(() =>
      expect(created[0].editor.save).toHaveBeenCalledOnce(),
    );
    const invalid = { blocks: false } as unknown as OutputData;
    host.model.set({ body: invalid });
    await fixture.whenStable();
    saving.resolve(document('Late draft'));
    await saving.promise;
    await fixture.whenStable();
    expect(host.model().body).toBe(invalid);
    expect(host.errors).toHaveLength(1);
    expect(host.changes).toEqual([]);
    expect(created[0].editor.render).not.toHaveBeenCalled();
    host.model.set({ body: document('Corrected') });
    await fixture.whenStable();
    await vi.waitFor(() =>
      expect(created[0].editor.render).toHaveBeenCalledOnce(),
    );
    expect(host.changes).toEqual([]);
    expect(host.fields.body().dirty()).toBe(false);
  });

  it('keeps two form owners independent and releases each child on disposal', async () => {
    const first = setup();
    const secondFixture = TestBed.createComponent(FormsHost);
    const second = secondFixture.componentInstance;
    await first.fixture.whenStable();
    await secondFixture.whenStable();
    await vi.waitFor(() => expect(second.ready).toHaveBeenCalledOnce());
    first.created[0].edit(document('First only'));
    await vi.waitFor(() => expect(first.host.changes).toHaveLength(1));
    expect(second.model().body.blocks[0].data).toEqual({ text: 'Initial' });
    expect(second.fields.body().dirty()).toBe(false);
    first.fixture.destroy();
    expect(first.created[0].editor.destroy).toHaveBeenCalledOnce();
    expect(first.created[1].editor.destroy).not.toHaveBeenCalled();
    first.created[1].edit(document('Second still live'));
    await vi.waitFor(() => expect(second.changes).toHaveLength(1));
    secondFixture.destroy();
    expect(first.created[1].editor.destroy).toHaveBeenCalledOnce();
  });

  it('suppresses late save results after conditional removal and initializes a fresh child on remount', async () => {
    const saving = deferred<OutputData>();
    const { fixture, host, created } = setup();
    await fixture.whenStable();
    await vi.waitFor(() => expect(host.ready).toHaveBeenCalledOnce());
    vi.mocked(created[0].editor.save).mockReturnValueOnce(saving.promise);
    created[0].edit(document('Unsaved'));
    await vi.waitFor(() =>
      expect(created[0].editor.save).toHaveBeenCalledOnce(),
    );
    host.visible.set(false);
    await fixture.whenStable();
    saving.resolve(document('Too late'));
    await saving.promise;
    await fixture.whenStable();
    expect(host.model().body.blocks[0].data).toEqual({ text: 'Initial' });
    expect(host.changes).toEqual([]);
    expect(host.errors).toEqual([]);
    expect(created[0].editor.destroy).toHaveBeenCalledOnce();
    host.visible.set(true);
    await fixture.whenStable();
    await vi.waitFor(() => expect(host.ready).toHaveBeenCalledTimes(2));
    expect(created[1].options.data).toEqual(document('Initial'));
    expect(host.fields.body().dirty()).toBe(false);
  });

  it('does not create after disposal during loading', async () => {
    const loading = deferred<EditorJsFactory>();
    const { fixture, host, created, create } = setup(() => loading.promise);
    await fixture.whenStable();
    fixture.destroy();
    loading.resolve(create);
    await loading.promise;
    await Promise.resolve();
    expect(created).toHaveLength(0);
    expect(host.ready).not.toHaveBeenCalled();
    expect(host.changes).toEqual([]);
  });

  it('disposes a not-yet-ready child when readiness eventually settles', async () => {
    const readiness = deferred<void>();
    const { fixture, host, created } = setup(undefined, readiness.promise);
    await fixture.whenStable();
    fixture.destroy();
    readiness.resolve();
    await vi.waitFor(() =>
      expect(created[0].editor.destroy).toHaveBeenCalledOnce(),
    );
    expect(host.ready).not.toHaveBeenCalled();
    expect(host.changes).toEqual([]);
    expect(host.errors).toEqual([]);
  });

  it('handles removal by a synchronous model listener without a late change output', async () => {
    const { fixture, host, created } = setup();
    await fixture.whenStable();
    await vi.waitFor(() => expect(host.ready).toHaveBeenCalledOnce());
    const control = fixture.debugElement.query(By.directive(EditorJsControl))
      .componentInstance as InstanceType<typeof EditorJsControl>;
    control.value.subscribe(() => fixture.destroy());
    created[0].edit(document('Last edit'));
    await vi.waitFor(() =>
      expect(created[0].editor.destroy).toHaveBeenCalledOnce(),
    );
    expect(host.changes).toEqual([]);
  });
});

describe('standalone value model binding', () => {
  function setupModel() {
    const created: ReturnType<typeof rawEditor>[] = [];
    TestBed.configureTestingModule({
      imports: [ModelHost, EditorJsControl],
      providers: [
        {
          provide: EDITOR_JS_LOADER,
          useValue: async () => (options: EditorJsCreateOptions) => {
            const raw = rawEditor(options);
            created.push(raw);
            return raw.editor;
          },
        },
      ],
    });
    return created;
  }

  it('supplies an empty document when the model has no binding', async () => {
    const created = setupModel();
    const fixture = TestBed.createComponent(EditorJsControl);
    await fixture.whenStable();
    await vi.waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].options.data).toEqual({ blocks: [] });
    expect(fixture.componentInstance.value()).toEqual({ blocks: [] });
  });

  it('supports two-way model binding without FormField and suppresses the echo', async () => {
    const created = setupModel();
    const fixture = TestBed.createComponent(ModelHost);
    const host = fixture.componentInstance;
    await fixture.whenStable();
    await vi.waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].options.data).toEqual(document('Model initial'));
    created[0].edit(document('Model edit'));
    await vi.waitFor(() =>
      expect(host.value()).toEqual(document('Model edit')),
    );
    await fixture.whenStable();
    expect(created[0].editor.render).not.toHaveBeenCalled();
    host.value.set(document('External'));
    await fixture.whenStable();
    await vi.waitFor(() =>
      expect(created[0].editor.render).toHaveBeenCalledWith(
        document('External'),
      ),
    );
    expect(host.errors).toEqual([]);
  });

  it('rejects an explicitly undefined binding and initializes after correction', async () => {
    const created = setupModel();
    const fixture = TestBed.createComponent(ModelHost);
    const host = fixture.componentInstance;
    host.value.set(undefined as unknown as OutputData);
    await fixture.whenStable();
    expect(created).toHaveLength(0);
    expect(host.value()).toBeUndefined();
    expect(host.errors).toMatchObject([
      { operation: 'data', code: 'invalid-data' },
    ]);
    host.value.set(document('Corrected'));
    await fixture.whenStable();
    await vi.waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].options.data).toEqual(document('Corrected'));
  });
});
