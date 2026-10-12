// @vitest-environment jsdom
import '@angular/compiler';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  FormField,
  form,
  disabled,
  readonly,
  validate,
  required,
} from '@angular/forms/signals';
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
  let readOnly = options.config?.readOnly ?? false;
  const editor: EditorJsInstance = {
    isReady,
    destroy: vi.fn(),
    clear: vi.fn(),
    focus: vi.fn(() => true),
    save: vi.fn(async () => {
      if (readOnly) throw new Error('Cannot save while readonly');
      return data;
    }),
    render: vi.fn(async (next) => {
      data = next;
      options.onChange();
    }),
    readOnly: {
      get isEnabled() {
        return readOnly;
      },
      toggle: vi.fn(async (value) => {
        readOnly = value;
        return value;
      }),
    },
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
        aria-label="Article body"
        aria-describedby="body-help"
        (touch)="touch()"
        (ready)="ready()"
        (change)="changes.push($event)"
        (error)="errors.push($event)"
      />
    }
  `,
})
class FormsHost {
  readonly model = signal<{ body: OutputData }>({ body: document('Initial') });
  readonly isDisabled = signal(false);
  readonly isReadonly = signal(false);
  readonly isInvalid = signal(false);
  readonly isRequired = signal(false);
  readonly fields = form(this.model, (path) => {
    disabled(path.body, () => this.isDisabled());
    readonly(path.body, () => this.isReadonly());
    required(path.body, { when: () => this.isRequired() });
    validate(path.body, () =>
      this.isInvalid()
        ? { kind: 'article', message: 'Explain the article.' }
        : undefined,
    );
  });
  readonly visible = signal(true);
  readonly ready = vi.fn();
  readonly touch = vi.fn();
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
    const node = fixture.debugElement.query(By.directive(EditorJsControl))
      .nativeElement as HTMLElement;
    expect(node.hasAttribute('aria-busy')).toBe(false);
    expect((node.firstElementChild as HTMLElement).inert).toBe(true);
    host.value.set(document('Corrected'));
    await fixture.whenStable();
    await vi.waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].options.data).toEqual(document('Corrected'));
  });
});

describe('native Forms interaction and availability', () => {
  async function readyControl() {
    const context = setup();
    await context.fixture.whenStable();
    await vi.waitFor(() => expect(context.host.ready).toHaveBeenCalledOnce());
    const element = context.fixture.debugElement.query(
      By.directive(EditorJsControl),
    );
    const control = element.componentInstance as InstanceType<
      typeof EditorJsControl
    >;
    const node = element.nativeElement as HTMLElement;
    const region = node.firstElementChild as HTMLElement;
    const raw = context.created[0];
    const input = globalThis.document.createElement('input');
    const toolbar = globalThis.document.createElement('button');
    const outside = globalThis.document.createElement('button');
    raw.options.holder.append(input, toolbar);
    context.fixture.nativeElement.append(outside);
    vi.mocked(raw.editor.focus).mockImplementation(() => {
      input.focus();
      return true;
    });
    return { ...context, control, node, region, raw, input, toolbar, outside };
  }

  it('emits touch once on composite exit, not on block/toolbar focus moves or readiness', async () => {
    const { fixture, host, input, toolbar, outside } = await readyControl();
    expect(host.touch).not.toHaveBeenCalled();
    input.focus();
    toolbar.focus();
    await fixture.whenStable();
    expect(host.touch).not.toHaveBeenCalled();
    expect(host.fields.body().touched()).toBe(false);
    outside.focus();
    await fixture.whenStable();
    expect(host.touch).toHaveBeenCalledOnce();
    expect(host.fields.body().touched()).toBe(true);
    expect(host.fields.body().dirty()).toBe(false);
    expect(host.changes).toEqual([]);
  });

  it('checks final focus when relatedTarget is null and emits no duplicate exit', async () => {
    const { fixture, host, input, toolbar, outside } = await readyControl();
    input.focus();
    input.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: null }),
    );
    toolbar.focus();
    await fixture.whenStable();
    expect(host.touch).not.toHaveBeenCalled();
    toolbar.blur();
    outside.focus();
    await fixture.whenStable();
    expect(host.touch).toHaveBeenCalledOnce();
  });

  it.each(['disabled', 'readonly'] as const)(
    'applies initial %s without dirty, touch or a redundant mode call',
    async (mode) => {
      const { fixture, host, created } = setup();
      (mode === 'disabled' ? host.isDisabled : host.isReadonly).set(true);
      await fixture.whenStable();
      await vi.waitFor(() => expect(host.ready).toHaveBeenCalledOnce());
      await fixture.whenStable();
      expect(created[0].options.config?.readOnly).toBe(true);
      expect(created[0].editor.readOnly.toggle).not.toHaveBeenCalled();
      const node = fixture.debugElement.query(By.directive(EditorJsControl))
        .nativeElement as HTMLElement;
      expect((node.firstElementChild as HTMLElement).inert).toBe(
        mode === 'disabled',
      );
      expect(node.getAttribute('tabindex')).toBe(
        mode === 'readonly' ? '0' : '-1',
      );
      expect(host.fields.body().dirty()).toBe(false);
      expect(host.fields.body().touched()).toBe(false);
      expect(host.changes).toEqual([]);
    },
  );

  it('reconciles availability changed while readiness is pending without reconfiguring', async () => {
    const readiness = deferred<void>();
    const { fixture, host, created } = setup(undefined, readiness.promise);
    await fixture.whenStable();
    host.isReadonly.set(true);
    await fixture.whenStable();
    expect(created[0].options.config?.readOnly).toBe(false);
    expect(created[0].editor.readOnly.toggle).not.toHaveBeenCalled();
    readiness.resolve();
    await vi.waitFor(() =>
      expect(created[0].editor.readOnly.toggle).toHaveBeenCalledWith(true),
    );
    expect(host.errors).toEqual([]);
    expect(host.changes).toEqual([]);
    expect(host.fields.body().dirty()).toBe(false);
  });

  it('blocks keyboard, pointer and editing events while disabled and suppresses artificial blur', async () => {
    const { fixture, host, raw, input, region, node, outside } =
      await readyControl();
    input.focus();
    host.isDisabled.set(true);
    await fixture.whenStable();
    await vi.waitFor(() => expect(raw.editor.readOnly.isEnabled).toBe(true));
    expect(region.inert).toBe(true);
    expect(node.getAttribute('aria-disabled')).toBe('true');
    expect(globalThis.document.activeElement).not.toBe(input);
    const listener = vi.fn();
    for (const type of [
      'keydown',
      'pointerdown',
      'click',
      'beforeinput',
      'paste',
      'cut',
      'drop',
    ]) {
      input.addEventListener(type, listener);
      const event = new Event(type, { bubbles: true, cancelable: true });
      input.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(listener).not.toHaveBeenCalled();
    input.focus();
    expect(globalThis.document.activeElement).not.toBe(input);
    outside.focus();
    await fixture.whenStable();
    expect(host.touch).not.toHaveBeenCalled();
    expect(host.fields.body().touched()).toBe(false);
    expect(host.fields.body().dirty()).toBe(false);
    expect(host.model().body.blocks[0].data).toEqual({ text: 'Initial' });
    host.isDisabled.set(false);
    await fixture.whenStable();
    await vi.waitFor(() => expect(region.inert).toBe(false));
    input.click();
    expect(listener).toHaveBeenCalledOnce();
    expect(host.errors).toEqual([]);
  });

  it('keeps interaction blocked until the last ordered rapid transition completes', async () => {
    const { fixture, host, raw, region } = await readyControl();
    const first = deferred<void>();
    const last = deferred<void>();
    const toggle = vi.mocked(raw.editor.readOnly.toggle);
    const apply = toggle.getMockImplementation();
    if (!apply) throw new Error('Expected fake mode driver');
    toggle.mockImplementationOnce(async (mode) => {
      await first.promise;
      return apply(mode);
    });
    toggle.mockImplementationOnce(async (mode) => {
      await last.promise;
      return apply(mode);
    });
    host.isReadonly.set(true);
    await fixture.whenStable();
    await vi.waitFor(() => expect(toggle).toHaveBeenCalledTimes(1));
    host.isReadonly.set(false);
    await fixture.whenStable();
    expect(region.inert).toBe(true);
    first.resolve();
    await vi.waitFor(() => expect(toggle).toHaveBeenCalledTimes(2));
    expect(toggle.mock.calls.map(([mode]) => mode)).toEqual([true, false]);
    expect(region.inert).toBe(true);
    last.resolve();
    await fixture.whenStable();
    await vi.waitFor(() => expect(region.inert).toBe(false));
    expect(raw.editor.readOnly.isEnabled).toBe(false);
    expect(host.errors).toEqual([]);
    expect(host.changes).toEqual([]);
  });

  it.each(['disabled', 'readonly'] as const)(
    'preserves an already-running saved edit when entering %s',
    async (mode) => {
      const { fixture, host, raw } = await readyControl();
      const saved = deferred<OutputData>();
      vi.mocked(raw.editor.save).mockReturnValueOnce(saved.promise);
      raw.edit(document('Before mode change'));
      await vi.waitFor(() => expect(raw.editor.save).toHaveBeenCalledOnce());
      (mode === 'disabled' ? host.isDisabled : host.isReadonly).set(true);
      await fixture.whenStable();
      expect(raw.editor.readOnly.toggle).not.toHaveBeenCalled();
      saved.resolve(document('Before mode change'));
      await vi.waitFor(() => expect(raw.editor.readOnly.isEnabled).toBe(true));
      await fixture.whenStable();
      expect(host.model().body.blocks[0].data).toEqual({
        text: 'Before mode change',
      });
      expect(host.changes).toHaveLength(1);
      // Angular suppresses computed dirty/touched for non-interactive fields.
      expect(host.fields.body().dirty()).toBe(false);
      expect(host.fields.body().touched()).toBe(false);
      expect(raw.editor.render).not.toHaveBeenCalled();
      (mode === 'disabled' ? host.isDisabled : host.isReadonly).set(false);
      await fixture.whenStable();
      await vi.waitFor(() => expect(raw.editor.readOnly.isEnabled).toBe(false));
      expect(host.fields.body().dirty()).toBe(true);
      expect(host.changes).toHaveLength(1);
    },
  );

  it.each(['disabled', 'readonly'] as const)(
    'allows value replacement and explicit-value reset while %s',
    async (mode) => {
      const { fixture, host, raw } = await readyControl();
      (mode === 'disabled' ? host.isDisabled : host.isReadonly).set(true);
      await fixture.whenStable();
      await vi.waitFor(() => expect(raw.editor.readOnly.isEnabled).toBe(true));
      host.model.set({ body: document('Replacement') });
      await fixture.whenStable();
      await vi.waitFor(() =>
        expect(raw.editor.render).toHaveBeenCalledWith(document('Replacement')),
      );
      host.fields.body().markAsDirty();
      host.fields.body().markAsTouched();
      host.fields.body().reset(document('Reset value'));
      await fixture.whenStable();
      await vi.waitFor(() =>
        expect(raw.editor.render).toHaveBeenLastCalledWith(
          document('Reset value'),
        ),
      );
      expect(host.model().body.blocks[0].data).toEqual({ text: 'Reset value' });
      expect(host.fields.body().dirty()).toBe(false);
      expect(host.fields.body().touched()).toBe(false);
      expect(host.changes).toEqual([]);
      expect(host.touch).not.toHaveBeenCalled();
      expect(host.errors).toEqual([]);
    },
  );

  it('retains requested field state and gates a failed transition until an explicit availability change', async () => {
    const { fixture, host, raw, region } = await readyControl();
    vi.mocked(raw.editor.readOnly.toggle).mockRejectedValueOnce(
      new Error('Unsupported tool'),
    );
    host.isReadonly.set(true);
    await fixture.whenStable();
    await vi.waitFor(() => expect(host.errors).toHaveLength(1));
    expect(host.errors[0]).toMatchObject({
      operation: 'readOnly',
      code: 'operation-failed',
    });
    expect(host.fields.body().readonly()).toBe(true);
    expect(raw.editor.readOnly.isEnabled).toBe(false);
    expect(region.inert).toBe(true);
    host.model.set({ body: document('Retained request') });
    await fixture.whenStable();
    await vi.waitFor(() => expect(raw.editor.render).toHaveBeenCalledOnce());
    expect(region.inert).toBe(true);
    host.isReadonly.set(false);
    await fixture.whenStable();
    await vi.waitFor(() => expect(region.inert).toBe(false));
    expect(raw.editor.readOnly.toggle).toHaveBeenCalledTimes(2);
    expect(host.errors).toHaveLength(1);
    expect(host.changes).toEqual([]);
  });

  it('treats an unsuccessful mode result as a gated failure', async () => {
    const { fixture, host, raw, region } = await readyControl();
    vi.mocked(raw.editor.readOnly.toggle).mockResolvedValueOnce(false);
    host.isReadonly.set(true);
    await fixture.whenStable();
    await vi.waitFor(() => expect(host.errors).toHaveLength(1));
    expect(host.errors[0]).toMatchObject({
      operation: 'readOnly',
      code: 'operation-failed',
    });
    expect(region.inert).toBe(true);
    expect(host.fields.body().readonly()).toBe(true);
  });

  it('exposes field presentation inputs and preserves consumer label/error associations on a group', async () => {
    const { fixture, host, control, node } = await readyControl();
    host.isInvalid.set(true);
    host.isRequired.set(true);
    host.fields.body().markAsTouched();
    await fixture.whenStable();
    expect(control.invalid()).toBe(true);
    expect(control.required()).toBe(true);
    expect(control.touched()).toBe(true);
    expect(control.dirty()).toBe(false);
    expect(control.errors()).toMatchObject([
      { kind: 'article', message: 'Explain the article.' },
    ]);
    expect(control.name()).toBe(host.fields.body().name());
    expect(node.getAttribute('role')).toBe('group');
    expect(node.getAttribute('aria-label')).toBe('Article body');
    expect(node.getAttribute('aria-describedby')).toBe('body-help');
    expect(node.getAttribute('data-invalid')).toBe('true');
    expect(node.hasAttribute('aria-invalid')).toBe(false);
    expect(node.hasAttribute('aria-required')).toBe(false);
    expect(node.hasAttribute('aria-readonly')).toBe(false);
    expect(host.changes).toEqual([]);
  });

  it('uses the native focus hook without marking interaction and focuses the group when readonly', async () => {
    const { fixture, host, control, raw, node, input } = await readyControl();
    expect(control.focus({ preventScroll: true })).toBeUndefined();
    await vi.waitFor(() =>
      expect(raw.editor.focus).toHaveBeenCalledWith(undefined),
    );
    expect(globalThis.document.activeElement).toBe(input);
    expect(host.touch).not.toHaveBeenCalled();
    expect(host.fields.body().dirty()).toBe(false);
    host.isReadonly.set(true);
    await fixture.whenStable();
    await vi.waitFor(() => expect(raw.editor.readOnly.isEnabled).toBe(true));
    await fixture.whenStable();
    host.fields.body().focusBoundControl({ preventScroll: true });
    expect(globalThis.document.activeElement).toBe(node);
    expect(raw.editor.focus).toHaveBeenCalledOnce();
    expect(host.touch).not.toHaveBeenCalled();
    host.isDisabled.set(true);
    await fixture.whenStable();
    control.focus();
    expect(globalThis.document.activeElement).not.toBe(node);
    expect(raw.editor.focus).toHaveBeenCalledOnce();
  });

  it.each(['false', 'throw'] as const)(
    'reports focus failure (%s) once without an unhandled rejection',
    async (failure) => {
      const { host, control, raw } = await readyControl();
      vi.mocked(raw.editor.focus).mockImplementation(() => {
        if (failure === 'throw') throw new Error('Focus unavailable');
        return false;
      });
      expect(control.focus()).toBeUndefined();
      await vi.waitFor(() => expect(host.errors).toHaveLength(1));
      expect(host.errors[0]).toMatchObject({
        operation: 'focus',
        code: 'operation-failed',
      });
      expect(host.changes).toEqual([]);
      expect(host.touch).not.toHaveBeenCalled();
    },
  );

  it('does not defer focus requested before readiness or emit after disposal', async () => {
    const readiness = deferred<void>();
    const { fixture, host, created } = setup(undefined, readiness.promise);
    await fixture.whenStable();
    const control = fixture.debugElement.query(By.directive(EditorJsControl))
      .componentInstance as InstanceType<typeof EditorJsControl>;
    control.focus();
    readiness.resolve();
    await vi.waitFor(() => expect(host.ready).toHaveBeenCalledOnce());
    expect(created[0].editor.focus).not.toHaveBeenCalled();
    fixture.destroy();
    control.focus();
    expect(created[0].editor.focus).not.toHaveBeenCalled();
    expect(host.errors).toEqual([]);
    expect(host.touch).not.toHaveBeenCalled();
  });

  it('cancels a queued composite touch when its owner is destroyed', async () => {
    const { fixture, host, input } = await readyControl();
    input.focus();
    input.blur();
    fixture.destroy();
    await Promise.resolve();
    expect(host.touch).not.toHaveBeenCalled();
    expect(host.errors).toEqual([]);
  });

  it('suppresses late transition errors and touch after destruction', async () => {
    const { fixture, host, raw, input } = await readyControl();
    const transition = deferred<void>();
    vi.mocked(raw.editor.readOnly.toggle).mockImplementationOnce(async () => {
      await transition.promise;
      throw new Error('Late failure');
    });
    input.focus();
    input.blur();
    host.isReadonly.set(true);
    await fixture.whenStable();
    await vi.waitFor(() =>
      expect(raw.editor.readOnly.toggle).toHaveBeenCalledOnce(),
    );
    host.touch.mockClear();
    fixture.destroy();
    transition.resolve();
    await transition.promise;
    await Promise.resolve();
    expect(host.errors).toEqual([]);
    expect(host.touch).not.toHaveBeenCalled();
    expect(raw.editor.destroy).toHaveBeenCalledOnce();
  });

  it('does not mark programmatic writes as touch but still observes the next user focus exit', async () => {
    const { fixture, host, input, outside, raw } = await readyControl();
    input.focus();
    host.model.set({ body: document('External write') });
    await fixture.whenStable();
    await vi.waitFor(() => expect(raw.editor.render).toHaveBeenCalledOnce());
    expect(host.touch).not.toHaveBeenCalled();
    outside.focus();
    await fixture.whenStable();
    expect(host.touch).toHaveBeenCalledOnce();
    expect(host.fields.body().dirty()).toBe(false);
  });

  it('suppresses blur from replaced editor DOM and still observes later null-relatedTarget exit', async () => {
    const { fixture, host, input, toolbar, raw } = await readyControl();
    input.focus();
    vi.mocked(raw.editor.render).mockImplementationOnce(async () => {
      input.blur();
      input.remove();
    });
    host.model.set({ body: document('Replacement') });
    await fixture.whenStable();
    await vi.waitFor(() => expect(raw.editor.render).toHaveBeenCalledOnce());
    expect(host.touch).not.toHaveBeenCalled();
    toolbar.focus();
    // A subsequent write need not replace the currently focused toolbar.
    host.model.set({ body: document('Another replacement') });
    await fixture.whenStable();
    await vi.waitFor(() => expect(raw.editor.render).toHaveBeenCalledTimes(2));
    toolbar.blur();
    await fixture.whenStable();
    expect(host.touch).toHaveBeenCalledOnce();
  });

  it('reflects validation pending without disabling an otherwise ready editor', async () => {
    setup();
    const fixture = TestBed.createComponent(EditorJsControl);
    fixture.componentRef.setInput('pending', true);
    await fixture.whenStable();
    await vi.waitFor(() =>
      expect(
        (fixture.nativeElement.firstElementChild as HTMLElement).inert,
      ).toBe(false),
    );
    expect(fixture.nativeElement.getAttribute('aria-busy')).toBe('true');
    fixture.componentRef.setInput('pending', false);
    await fixture.whenStable();
    expect(fixture.nativeElement.hasAttribute('aria-busy')).toBe(false);
  });

  it('keeps interaction and availability independent across controls', async () => {
    const first = await readyControl();
    const secondFixture = TestBed.createComponent(FormsHost);
    await secondFixture.whenStable();
    await vi.waitFor(() =>
      expect(secondFixture.componentInstance.ready).toHaveBeenCalledOnce(),
    );
    first.host.isDisabled.set(true);
    await first.fixture.whenStable();
    await vi.waitFor(() =>
      expect(first.raw.editor.readOnly.isEnabled).toBe(true),
    );
    const secondRaw = first.created[1];
    expect(secondRaw.editor.readOnly.toggle).not.toHaveBeenCalled();
    secondRaw.edit(document('Independent edit'));
    await vi.waitFor(() =>
      expect(secondFixture.componentInstance.changes).toHaveLength(1),
    );
    expect(first.host.changes).toEqual([]);
    expect(first.host.fields.body().dirty()).toBe(false);
    expect(secondFixture.componentInstance.fields.body().dirty()).toBe(true);
  });
});
