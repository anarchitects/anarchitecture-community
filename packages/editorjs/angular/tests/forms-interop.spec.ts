// @vitest-environment jsdom
import '@angular/compiler';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  FormControl,
  FormGroup,
  FormsModule,
  NgModel,
  ReactiveFormsModule,
} from '@angular/forms';
import { FormField, disabled, validate } from '@angular/forms/signals';
import {
  compatForm,
  extractValue,
  SignalFormControl,
} from '@angular/forms/signals/compat';
import { By } from '@angular/platform-browser';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type {
  EditorJsErrorEvent,
  OutputData,
} from '@anarchitects/editorjs-core';
import type {
  EditorJsCreateOptions,
  EditorJsFactory,
  EditorJsInstance,
} from '../src/index.js';

// The same contract runs locally against APF and in each isolated packed consumer.
const require = createRequire(import.meta.url);
const packed = process.env['EDITORJS_INTEROP_PACKED'] === 'true';
const artifacts = resolve(
  import.meta.dirname,
  '../../../../dist/packages/editorjs/angular/fesm2022',
);
const { EDITOR_JS_LOADER } = require(
  packed
    ? '@anarchitects/editorjs-angular'
    : resolve(artifacts, 'anarchitects-editorjs-angular.mjs'),
) as typeof import('../src/index.js');
const { EditorJsControl } = require(
  packed
    ? '@anarchitects/editorjs-angular/forms'
    : resolve(artifacts, 'anarchitects-editorjs-angular-forms.mjs'),
) as typeof import('../forms/src/index.js');

type Binding = 'control' | 'name' | 'model' | 'compat' | 'signal';
let updateOn: 'change' | 'blur' | 'submit' = 'change';
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
function rawEditor(options: EditorJsCreateOptions) {
  if (!options.data) throw new Error('Expected an initial document');
  let data = options.data;
  let readOnly = options.config?.readOnly ?? false;
  const editor: EditorJsInstance = {
    isReady: Promise.resolve(),
    destroy: vi.fn(),
    clear: vi.fn(),
    focus: vi.fn(() => true),
    save: vi.fn(async () => data),
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
  selector: 'aa-interop-test-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EditorJsControl, ReactiveFormsModule, FormsModule, FormField],
  template: `
    @switch (binding) {
      @case ('control') {
        <aa-editorjs-control
          [formControl]="body"
          (error)="errors.push($event)"
        />
      }
      @case ('name') {
        <form [formGroup]="group">
          <aa-editorjs-control
            formControlName="body"
            (error)="errors.push($event)"
          />
        </form>
      }
      @case ('model') {
        <form>
          <aa-editorjs-control
            name="body"
            [(ngModel)]="model"
            [ngModelOptions]="modelOptions"
            [disabled]="unavailable()"
            (error)="errors.push($event)"
          />
        </form>
      }
      @case ('compat') {
        <aa-editorjs-control
          [formField]="fields.body"
          (error)="errors.push($event)"
        />
      }
      @case ('signal') {
        <aa-editorjs-control
          [formField]="signalBody.fieldTree"
          (error)="errors.push($event)"
        />
      }
    }
  `,
})
class InteropHost {
  binding: Binding = 'control';
  readonly body = new FormControl(document('Initial'), {
    nonNullable: true,
    updateOn,
  });
  readonly group = new FormGroup({ body: this.body });
  model = document('Initial');
  readonly modelOptions = { updateOn };
  readonly unavailable = signal(false);
  readonly rejected = signal(false);
  readonly legacyModel = signal({ body: this.body });
  readonly fields = compatForm(this.legacyModel);
  readonly signalBody = new SignalFormControl(document('Initial'), (path) => {
    disabled(path, () => this.unavailable());
    validate(path, () =>
      this.rejected()
        ? { kind: 'content', message: 'Write content.' }
        : undefined,
    );
  });
  readonly signalGroup = new FormGroup({ body: this.signalBody });
  readonly errors: EditorJsErrorEvent[] = [];
}

async function setup(binding: Binding) {
  const created: ReturnType<typeof rawEditor>[] = [];
  const create: EditorJsFactory = (options) => {
    const raw = rawEditor(options);
    created.push(raw);
    return raw.editor;
  };
  TestBed.configureTestingModule({
    imports: [InteropHost],
    providers: [{ provide: EDITOR_JS_LOADER, useValue: async () => create }],
  });
  const fixture = TestBed.createComponent(InteropHost);
  const host = fixture.componentInstance;
  host.binding = binding;
  await fixture.whenStable();
  const element = fixture.debugElement.query(By.directive(EditorJsControl));
  const control = element.componentInstance as InstanceType<
    typeof EditorJsControl
  >;
  if (binding === 'model') {
    expect(host.errors).toEqual([
      expect.objectContaining({ operation: 'data', code: 'invalid-data' }),
    ]);
    host.errors.length = 0;
  } else {
    expect(host.errors).toEqual([]);
  }
  const legacy =
    binding === 'model' ? element.injector.get(NgModel).control : host.body;
  await vi.waitFor(() => expect(created).toHaveLength(1));
  return { fixture, host, control, legacy, raw: created[0] };
}

beforeAll(() =>
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()),
);
afterEach(() => {
  TestBed.resetTestingModule();
  updateOn = 'change';
});

for (const binding of [
  'control',
  'name',
  'model',
  'compat',
  'signal',
] as const) {
  describe(`native ${binding} binding`, () => {
    it('projects values and publishes one detached edit with native dirty/touched state', async () => {
      const { fixture, host, control, legacy, raw } = await setup(binding);
      expect(raw.options.data).toMatchObject(document('Initial'));
      const state = binding === 'signal' ? host.signalBody : legacy;
      expect(state.pristine).toBe(true);
      expect(state.untouched).toBe(true);
      const edits = vi.fn();
      control.change.subscribe(edits);
      raw.edit(document('Edited'));
      await vi.waitFor(() =>
        expect(state.value).toMatchObject(document('Edited')),
      );
      await fixture.whenStable();
      expect(state.dirty).toBe(true);
      expect(edits).toHaveBeenCalledOnce();
      expect(edits.mock.calls[0][0].data).not.toBe(state.value);
      expect(raw.editor.render).not.toHaveBeenCalled();
      control.touch.emit();
      await fixture.whenStable();
      expect(state.touched).toBe(true);
      expect(control.touched()).toBe(true);
      if (binding === 'model')
        expect(host.model).toMatchObject(document('Edited'));
      if (binding === 'signal')
        expect(host.signalGroup.value.body).toMatchObject(document('Edited'));
      if (binding === 'name')
        expect(host.group.value.body).toMatchObject(document('Edited'));
      if (binding === 'compat') {
        expect(host.legacyModel().body).toBe(legacy);
        expect(extractValue(host.fields)).toMatchObject({
          body: document('Edited'),
        });
      }
    });

    it('projects programmatic writes, disablement and validation separately from operational errors', async () => {
      const { fixture, host, control, legacy, raw } = await setup(binding);
      if (binding === 'model') {
        host.model = document('Written');
        fixture.changeDetectorRef.markForCheck();
      } else if (binding === 'signal')
        host.signalBody.setValue(document('Written'));
      else legacy.setValue(document('Written'));
      await fixture.whenStable();
      await vi.waitFor(() =>
        expect(raw.editor.render).toHaveBeenCalledWith(document('Written')),
      );
      const state = binding === 'signal' ? host.signalBody : legacy;
      expect(state.pristine).toBe(true);
      if (binding === 'signal' || binding === 'model')
        host.unavailable.set(true);
      else legacy.disable();
      await fixture.whenStable();
      await vi.waitFor(() => expect(raw.editor.readOnly.isEnabled).toBe(true));
      expect(control.disabled()).toBe(true);
      expect(state.value).toMatchObject(document('Written'));
      if (binding === 'signal' || binding === 'model')
        host.unavailable.set(false);
      else legacy.enable();
      await fixture.whenStable();
      if (binding === 'signal') host.rejected.set(true);
      else legacy.setErrors({ content: { message: 'Write content.' } });
      await fixture.whenStable();
      expect(control.invalid()).toBe(true);
      expect(control.errors()).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: 'content' })]),
      );
      expect(host.errors).toEqual([]);
      if (binding !== 'signal') {
        legacy.markAsPending();
        fixture.changeDetectorRef.markForCheck();
        await fixture.whenStable();
        expect(control.pending()).toBe(true);
      }
    });

    it('resets with a non-null value and invalidates pending saves using the documented hook', async () => {
      const { fixture, host, control, legacy, raw } = await setup(binding);
      const saved = deferred<OutputData>();
      vi.mocked(raw.editor.save).mockReturnValueOnce(saved.promise);
      raw.edit(document('Obsolete'));
      await vi.waitFor(() => expect(raw.editor.save).toHaveBeenCalled());
      // Direct legacy controls and compat leaves do not dispatch the native reset hook.
      if (binding !== 'signal') control.reset();
      if (binding === 'signal') host.signalBody.reset(document('Reset'));
      else if (binding === 'model') {
        host.model = document('Reset');
        legacy.reset(host.model);
        fixture.changeDetectorRef.markForCheck();
      } else legacy.reset(document('Reset'));
      saved.resolve(document('Obsolete'));
      await fixture.whenStable();
      await vi.waitFor(() =>
        expect(raw.editor.render).toHaveBeenCalledWith(document('Reset')),
      );
      const state = binding === 'signal' ? host.signalBody : legacy;
      expect(state.value).toMatchObject(document('Reset'));
      expect(state.pristine).toBe(true);
      expect(state.untouched).toBe(true);
      expect(host.errors).toEqual([]);
    });
  });
}

for (const strategy of ['blur', 'submit'] as const) {
  for (const binding of ['control', 'name', 'model', 'compat'] as const) {
    it(`${binding} publishes immediately with updateOn ${strategy}; no legacy deferral is promised`, async () => {
      updateOn = strategy;
      const { legacy, raw } = await setup(binding);
      raw.edit(document('Immediate'));
      await vi.waitFor(() =>
        expect(legacy.value).toMatchObject(document('Immediate')),
      );
      expect(legacy.dirty).toBe(true);
      expect(legacy.untouched).toBe(true);
    });
  }
}

it('rejects a nullable legacy reset without replacing the requested model or fabricating field errors', async () => {
  const { fixture, host, legacy, control, raw } = await setup('control');
  control.reset();
  legacy.reset(null);
  await fixture.whenStable();
  expect(legacy.value).toBeNull();
  expect(legacy.errors).toBeNull();
  expect(host.errors).toEqual([
    expect.objectContaining({ code: 'invalid-data', operation: 'data' }),
  ]);
  raw.edit(document('Ignored'));
  await fixture.whenStable();
  expect(legacy.value).toBeNull();
  legacy.reset(document('Recovered'));
  await fixture.whenStable();
  expect(raw.editor.render).toHaveBeenCalledWith(document('Recovered'));
});

it('requires event-emitting writes for compatForm to observe a retained FormControl', async () => {
  const { fixture, host, legacy, control } = await setup('compat');
  legacy.setValue(document('Silent'), { emitEvent: false });
  await fixture.whenStable();
  expect(legacy.value).toEqual(document('Silent'));
  expect(host.fields.body().value()).toMatchObject(document('Initial'));
  expect(control.value()).toMatchObject(document('Initial'));
  legacy.updateValueAndValidity();
  await fixture.whenStable();
  expect(control.value()).toMatchObject(document('Silent'));
});

it('keeps SignalFormControl availability and errors schema-owned', async () => {
  const { host } = await setup('signal');
  expect(() => host.signalBody.disable()).toThrow();
  expect(() => host.signalBody.setErrors({ server: true })).toThrow();
  expect(() => host.signalBody.setValidators(() => null)).toThrow();
});

for (const binding of ['control', 'name', 'model', 'compat'] as const) {
  it(`${binding} needs the explicit hook for an unchanged-value reset during a save`, async () => {
    const { fixture, host, control, legacy, raw } = await setup(binding);
    const saved = deferred<OutputData>();
    vi.mocked(raw.editor.save).mockReturnValueOnce(saved.promise);
    const result = control.save();
    const rejected = expect(result).rejects.toMatchObject({
      code: 'superseded',
    });
    await vi.waitFor(() => expect(raw.editor.save).toHaveBeenCalled());
    const hook = vi.spyOn(control, 'reset');
    legacy.reset(legacy.value);
    expect(hook).not.toHaveBeenCalled();
    control.reset();
    saved.resolve(document('Obsolete'));
    await rejected;
    await fixture.whenStable();
    await vi.waitFor(() =>
      expect(raw.editor.render).toHaveBeenCalledWith(document('Initial')),
    );
    expect(legacy.pristine).toBe(true);
    expect(legacy.untouched).toBe(true);
    expect(host.errors).toEqual([
      expect.objectContaining({ code: 'superseded', operation: 'save' }),
    ]);
  });
}

it('resets a non-nullable FormControl to its initial document without an explicit value', async () => {
  const { fixture, legacy, control, raw } = await setup('control');
  legacy.setValue(document('Written'));
  await fixture.whenStable();
  control.reset();
  legacy.reset();
  await fixture.whenStable();
  expect(legacy.value).toEqual(document('Initial'));
  expect(raw.editor.render).toHaveBeenLastCalledWith(document('Initial'));
});

it('uses the SignalFormControl native hook for an unchanged-value reset and clears parent flags', async () => {
  const { fixture, host, control } = await setup('signal');
  control.touch.emit();
  host.signalBody.markAsDirty();
  await fixture.whenStable();
  expect(host.signalGroup.touched).toBe(true);
  expect(host.signalGroup.dirty).toBe(true);
  const hook = vi.spyOn(control, 'reset');
  host.signalBody.reset();
  expect(hook).toHaveBeenCalledOnce();
  await fixture.whenStable();
  expect(host.signalGroup.pristine).toBe(true);
  expect(host.signalGroup.untouched).toBe(true);
  expect(host.signalBody.value).toMatchObject(document('Initial'));
});

for (const binding of ['control', 'name', 'model', 'compat'] as const) {
  it(`${binding} forwards async validator pending/errors without an operational failure`, async () => {
    const { fixture, host, control, legacy } = await setup(binding);
    const checked = deferred<{ review: { message: string } } | null>();
    legacy.setAsyncValidators(() => checked.promise);
    legacy.updateValueAndValidity();
    await fixture.whenStable();
    expect(control.pending()).toBe(true);
    checked.resolve({ review: { message: 'Needs review.' } });
    await vi.waitFor(() => expect(legacy.invalid).toBe(true));
    await fixture.whenStable();
    expect(control.pending()).toBe(false);
    expect(control.invalid()).toBe(true);
    expect(control.errors()).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'review' })]),
    );
    expect(host.errors).toEqual([]);
  });

  it(
    binding === 'model'
      ? 'characterizes a stale ngModel view after a simultaneous model write and editor reset'
      : `${binding} fences an authoritative write before Angular delivers its input`,
    async () => {
      const { fixture, host, control, legacy, raw } = await setup(binding);
      const saved = deferred<OutputData>();
      vi.mocked(raw.editor.save).mockReturnValueOnce(saved.promise);
      raw.edit(document('Obsolete'));
      await vi.waitFor(() => expect(raw.editor.save).toHaveBeenCalled());
      control.reset();
      if (binding === 'model') {
        host.model = document('Authoritative');
        fixture.changeDetectorRef.markForCheck();
      } else legacy.setValue(document('Authoritative'));
      saved.resolve(document('Obsolete'));
      await fixture.whenStable();
      await vi.waitFor(() =>
        expect(raw.editor.render).toHaveBeenCalledWith(
          document(binding === 'model' ? 'Initial' : 'Authoritative'),
        ),
      );
      expect(legacy.value).toMatchObject(
        document(binding === 'model' ? 'Initial' : 'Authoritative'),
      );
      if (binding === 'model')
        expect(host.model).toMatchObject(document('Authoritative'));
      expect(legacy.pristine).toBe(true);
      expect(host.errors).toEqual([]);
    },
  );
}
