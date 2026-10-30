# Compose custom tools with Angular

Use the same application-owned tools in standalone Angular and native Signal
Forms. This recipe uses Angular 22, Editor.js 2.31.7 and `@editorjs/code@2.9.4`.
Install `@anarchitects/editorjs-angular`, `@anarchitects/editorjs-core` and
`@editorjs/editorjs@2.31.7`, then `npm install --save-exact @editorjs/code@2.9.4`.
Use matching Angular core/common/compiler packages and the application builder.
Forms is needed only for the final example.

Copy these files from the installed core package's
[custom-tool guide](https://github.com/anarchitects/anarchitecture-community/blob/main/packages/editorjs/core/custom-tools.md)
into a `custom/` directory beside the files below: `callout-data.ts`,
`callout-tool.ts`, `editorial-data.ts`, `marker-tool.ts`, `flag-tune.ts`,
`code-data.ts` and `code-settings.ts`. These are complete application sources,
not package exports. Keep their validation, sanitization and keyboard limitations;
Angular does not replace their implementation. Use TypeScript Bundler resolution.

## Share definitions and document validation

The following file has no Angular runtime imports. Each call creates fresh config
objects. Tool classes stay behind dynamic imports; neither provider construction
nor server evaluation loads them. The marker receives only its own editor region.
Use the same configured names when saving, validating and restoring documents.

<!-- custom-example-file: custom-definitions.ts -->

```ts
import {
  validateOutputData,
  type OutputData,
  type OutputDataValidationResult,
} from '@anarchitects/editorjs-core';
import { validateCallout } from './custom/callout-data.js';
import { isFlagData } from './custom/editorial-data.js';
import { validateCode } from './custom/code-data.js';
import { codeSettings } from './custom/code-settings.js';

export function calloutDefinition(label: string) {
  return {
    name: 'callout',
    kind: 'block',
    source: 'lazy',
    load: () => import('./custom/callout-tool.js').then((m) => m.CalloutTool),
    settings: {
      config: { label },
      inlineToolbar: ['bold', 'marker'],
      tunes: ['flag'],
    },
  } as const;
}

export function customDefinitions(holder: HTMLElement, label: string) {
  return [
    calloutDefinition(label),
    {
      name: 'marker',
      kind: 'inline',
      source: 'lazy',
      load: () => import('./custom/marker-tool.js').then((m) => m.MarkerTool),
      settings: { config: { holder } },
    },
    {
      name: 'flag',
      kind: 'tune',
      source: 'lazy',
      load: () => import('./custom/flag-tune.js').then((m) => m.FlagTune),
    },
    {
      name: 'code',
      kind: 'block',
      source: 'lazy',
      load: () => import('@editorjs/code').then((m) => m.default),
      settings: codeSettings({ placeholder: `${label} code` }),
    },
  ] as const;
}
export const customSelection = ['callout', 'marker', 'flag', 'code'] as const;

export function validateCustomDocument(
  input: unknown,
): OutputDataValidationResult {
  const result = validateOutputData(input, {
    toolValidators: new Map([
      ['callout', validateCallout],
      ['code', validateCode],
    ]),
    unknownTools: 'reject',
  });
  if (!result.ok) return result;
  for (const [index, block] of result.data.blocks.entries()) {
    for (const [name, value] of Object.entries(block.tunes ?? {})) {
      if (block.type !== 'callout' || name !== 'flag' || !isFlagData(value))
        return {
          ok: false,
          errors: [
            {
              source: 'tool',
              code: 'tool_data_invalid',
              path: ['blocks', index, 'tunes', name],
              message: 'Only callout supports the boolean flag tune',
            },
          ],
        };
    }
  }
  return result;
}
export function readCustomDocument(input: unknown): OutputData {
  const result = validateCustomDocument(input);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.data;
}
export const initialCustomDocument = (label: string): OutputData => ({
  blocks: [
    { type: 'callout', data: { text: `${label} callout`, tone: 'info' } },
    { type: 'code', data: { code: `// ${label}` } },
  ],
});
```

Block validators remain core callbacks; the application separately validates
tune payloads. This document accepts only callout and code blocks. It is not
a universal tool validator or a persistence format imposed by the package.

## Own provider environments explicitly

Save as `custom-environment.ts`. The parent selects its available tools; the child
inherits that selected snapshot and deliberately replaces the whole callout
definition. Replacement retains inline/tune references explicitly. Factories
capture their dependencies synchronously, before lazy loaders run.

<!-- custom-example-file: custom-environment.ts -->

```ts
import {
  createEnvironmentInjector,
  EnvironmentInjector,
  inject,
  InjectionToken,
} from '@angular/core';
import { provideEditorJsTools } from '@anarchitects/editorjs-angular';
import {
  calloutDefinition,
  customDefinitions,
  customSelection,
} from './custom-definitions.js';

export const CUSTOM_CONTEXT = new InjectionToken<{
  holder: HTMLElement;
  label: string;
}>('custom editor context');

export function customEnvironment(
  parent: EnvironmentInjector,
  holder: HTMLElement,
  label: string,
) {
  const base = createEnvironmentInjector(
    [
      { provide: CUSTOM_CONTEXT, useValue: { holder, label } },
      provideEditorJsTools(
        {
          factory: () => {
            const context = inject(CUSTOM_CONTEXT);
            return customDefinitions(context.holder, context.label);
          },
        },
        { select: customSelection },
      ),
    ],
    parent,
  );
  const child = createEnvironmentInjector(
    [
      provideEditorJsTools(
        {
          factory: () => {
            const { label } = inject(CUSTOM_CONTEXT);
            return [
              { ...calloutDefinition(`${label} selected`), replace: true },
            ];
          },
        },
        { inherit: true, select: customSelection },
      ),
    ],
    base,
  );
  let destroyed = false;
  return {
    injector: child,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      child.destroy();
      base.destroy();
    },
  };
}
```

Environment providers do not belong in component `providers`. Each mounted editor
below gets its own environments, config and tool instances. Sharing immutable
module code is safe; sharing mutable config or DOM holders across editors is not.
Parent factories run in the parent's context, so a child token override cannot
retroactively change captured parent dependencies. An unselected parent tool
cannot be recovered by child selection. Route navigation alone does not prove
an injector was destroyed; the owner below explicitly destroys both environments.

## Standalone direct and provider composition

Save as `custom-editor.ts`. Provider mode omits `config.tools`. Direct mode
resolves the same neutral definitions after browser rendering and supplies a
complete explicit map; that map wins over the provider snapshot in full.
An explicit empty map also bypasses providers, but would not render this custom
document. Resolve code before creating the wrapper and dispose the resolver
if the owner disappears during loading.

<!-- custom-example-file: custom-editor.ts -->

```ts
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import {
  EditorJs,
  EDITOR_JS_TOOL_REGISTRY,
  type EditorJsConfig,
} from '@anarchitects/editorjs-angular';
import {
  composeToolRegistry,
  createToolResolver,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
  type EditorJsErrorEvent,
} from '@anarchitects/editorjs-core';
import { CUSTOM_CONTEXT } from './custom-environment.js';
import {
  customDefinitions,
  customSelection,
  initialCustomDocument,
  readCustomDocument,
} from './custom-definitions.js';

@Component({
  selector: 'app-custom-editor',
  imports: [EditorJs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>Available tools: {{ names() }}</p>
    @if (config(); as options) {
      <aa-editorjs
        [config]="options"
        [data]="data"
        (ready)="onReady()"
        (change)="status.set('Changed')"
        (error)="onError($event)"
      />
    }
    <button type="button" [disabled]="!ready()" (click)="save()">Save</button>
    <button type="button" [disabled]="!ready()" (click)="reload()">
      Reload
    </button>
    <button type="button" [disabled]="!ready()" (click)="toggle()">
      Toggle readonly
    </button>
    <p role="status">{{ status() }}</p>
    <pre aria-label="Saved document">{{ saved() }}</pre>
  `,
})
export class CustomEditor {
  readonly direct = input(false);
  readonly context = inject(CUSTOM_CONTEXT);
  readonly names = signal('');
  private readonly injector = inject(Injector);
  readonly lifetime = inject(DestroyRef);
  readonly editor = viewChild(EditorJs);
  readonly data = readCustomDocument(initialCustomDocument(this.context.label));
  readonly config = signal<EditorJsConfig | undefined>(undefined);
  readonly ready = signal(false);
  readonly status = signal('Loading');
  readonly saved = signal(JSON.stringify(this.data));
  private readOnly = false;

  constructor() {
    afterNextRender(() => {
      if (!this.direct()) {
        this.config.set({ defaultBlock: 'callout', minHeight: 60 });
        return;
      }
      const resolver = createToolResolver(
        composeToolRegistry(
          [
            customDefinitions(
              this.context.holder,
              `${this.context.label} explicit`,
            ),
          ],
          { profile: EDITOR_JS_2_31_7_TOOL_PROFILE },
        ),
      );
      this.lifetime.onDestroy(() => resolver.dispose());
      void resolver
        .resolve()
        .then((tools) => {
          if (!this.lifetime.destroyed)
            this.config.set({ defaultBlock: 'callout', minHeight: 60, tools });
        })
        .catch((error: unknown) => this.report(error));
    });
  }
  onReady() {
    // Read a successful provider snapshot only after wrapper initialization.
    // Direct editors never inspect providers that their explicit map bypasses.
    const names = this.direct()
      ? customSelection
      : this.injector.get(EDITOR_JS_TOOL_REGISTRY).names;
    this.names.set(names.join(','));
    this.ready.set(true);
    this.status.set('Ready');
  }
  onError(event: EditorJsErrorEvent) {
    this.report(`${event.operation}: ${event.code}`);
  }
  report(error: unknown) {
    if (!this.lifetime.destroyed) this.status.set(String(error));
  }
  async save() {
    try {
      const data = readCustomDocument(await this.editor()!.api.save());
      if (!this.lifetime.destroyed) {
        this.saved.set(JSON.stringify(data));
        this.status.set('Saved');
      }
    } catch (error) {
      this.report(error);
    }
  }
  async reload() {
    try {
      await this.editor()!.api.render(readCustomDocument(this.saved()));
      if (!this.lifetime.destroyed) this.status.set('Reloaded');
    } catch (error) {
      this.report(error);
    }
  }
  async toggle() {
    try {
      this.readOnly = await this.editor()!.api.setReadOnly(!this.readOnly);
      if (!this.lifetime.destroyed)
        this.status.set(this.readOnly ? 'Read only' : 'Editable');
    } catch (error) {
      this.report(error);
    }
  }
}
```

Save as `custom-page.ts`. This host activates on the browser render boundary.
Both regions are stable, empty server markup until activation. Removing an editor
destroys its component before its environments; remount creates a fresh owner.

<!-- custom-example-file: custom-page.ts -->

```ts
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EnvironmentInjector,
  inject,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { CustomEditor } from './custom-editor.js';
import { customEnvironment } from './custom-environment.js';

@Component({
  selector: 'app-custom-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Custom tool editors</h1>
    <section #directHolder aria-label="Direct editor">
      <ng-container #directSlot />
    </section>
    <button type="button" (click)="remove('direct')">Remove direct</button>
    <button type="button" (click)="mount('direct')">Remount direct</button>
    <section #providerHolder aria-label="Provider editor">
      <ng-container #providerSlot />
    </section>
    <button type="button" (click)="remove('provider')">Remove provider</button>
    <button type="button" (click)="mount('provider')">Remount provider</button>
  `,
})
export class CustomPage {
  readonly parent = inject(EnvironmentInjector);
  readonly lifetime = inject(DestroyRef);
  readonly directSlot = viewChild.required('directSlot', {
    read: ViewContainerRef,
  });
  readonly providerSlot = viewChild.required('providerSlot', {
    read: ViewContainerRef,
  });
  readonly directHolder =
    viewChild.required<ElementRef<HTMLElement>>('directHolder');
  readonly providerHolder =
    viewChild.required<ElementRef<HTMLElement>>('providerHolder');
  private readonly owners = new Map<string, () => void>();
  constructor() {
    afterNextRender(() => {
      this.mount('direct');
      this.mount('provider');
    });
    this.lifetime.onDestroy(() => {
      this.remove('direct');
      this.remove('provider');
    });
  }
  mount(mode: 'direct' | 'provider') {
    if (this.lifetime.destroyed || this.owners.has(mode)) return;
    const slot = mode === 'direct' ? this.directSlot() : this.providerSlot();
    const holder =
      mode === 'direct' ? this.directHolder() : this.providerHolder();
    const environment = customEnvironment(
      this.parent,
      holder.nativeElement,
      mode,
    );
    const component = slot.createComponent(CustomEditor, {
      environmentInjector: environment.injector,
    });
    component.setInput('direct', mode === 'direct');
    this.owners.set(mode, () => {
      component.destroy();
      environment.destroy();
    });
  }
  remove(mode: 'direct' | 'provider') {
    this.owners.get(mode)?.();
    this.owners.delete(mode);
  }
}
```

Bootstrap `CustomPage` with `bootstrapApplication(CustomPage)` and an
`<app-custom-page></app-custom-page>` host in your application's index. No Forms
import or peer is needed. In an existing routed application, use a lazy component
route. The application owns hydration providers; see the README's supported
hydration configuration. Do not initialize these browser sessions during SSR.

Config is initialization-only. Replacing `config` after creation reports
`config-changed`; it does not swap tools. Change content through data or `api.render`,
change availability through `api.setReadOnly`, and remount to change tool config.
Provider composition errors report the `config` stage, tool import errors `load`,
and editor construction/readiness failures `create`/`ready`. A failed initialization
does not retry. Correct the cause and remount; correct failed DI factories by
creating new environments too. Browser module errors may require a full page reload.

## Optional native Signal Forms

Install the same-version `@angular/forms` peer and import only the `/forms` entry
for `EditorJsControl`. It already implements `FormValueControl<OutputData>`;
do not add a CVA or a second form-state owner. The model owns the document;
`[formField]` owns dirty/touched, availability and validation state.

Save as `custom-form.ts`. The asynchronous review and persistence tokens have
local demonstration defaults. Supply application-owned implementations for a real
backend, honoring cancellation and authorization. The demo does not persist data.

<!-- custom-example-file: custom-form.ts -->

```ts
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EnvironmentInjector,
  inject,
  InjectionToken,
  resource,
  signal,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import {
  disabled,
  form,
  FormField,
  readonly as readonlyField,
  submit,
  validate,
  validateAsync,
} from '@angular/forms/signals';
import { EditorJsControl } from '@anarchitects/editorjs-angular/forms';
import {
  normalizeOutputData,
  type EditorJsErrorEvent,
  type OutputData,
} from '@anarchitects/editorjs-core';
import { customEnvironment } from './custom-environment.js';
import {
  initialCustomDocument,
  readCustomDocument,
  validateCustomDocument,
} from './custom-definitions.js';

export const CUSTOM_REVIEW = new InjectionToken<
  (document: OutputData, signal: AbortSignal) => Promise<boolean>
>('custom review', { providedIn: 'root', factory: () => async () => true });
export const CUSTOM_PERSIST = new InjectionToken<
  (document: OutputData, signal: AbortSignal) => Promise<boolean>
>('custom persistence', {
  providedIn: 'root',
  factory: () => async () => true,
});

@Component({
  selector: 'app-custom-form',
  imports: [EditorJsControl, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [inert]="saving()" [attr.inert]="saving() ? '' : null">
      <aa-editorjs-control
        aria-label="Custom document"
        [formField]="fields.body"
        [config]="config"
        (ready)="ready.set(true)"
        (error)="onError($event)"
      />
    </div>
    <button
      type="button"
      [disabled]="!ready() || saving() || fields().pending() || locked()"
      (click)="save()"
    >
      Save document
    </button>
    <button type="button" [disabled]="saving()" (click)="reset()">
      Reset document
    </button>
    <button type="button" [disabled]="saving()" (click)="locked.set(!locked())">
      Toggle disabled
    </button>
    <button
      type="button"
      [disabled]="saving()"
      (click)="reviewing.set(!reviewing())"
    >
      Toggle readonly
    </button>
    <p aria-label="Dirty">{{ fields.body().dirty() }}</p>
    <p aria-label="Touched">{{ fields.body().touched() }}</p>
    <p aria-label="Validation pending">{{ fields().pending() }}</p>
    <p aria-label="Submitting">{{ fields().submitting() }}</p>
    @for (error of fields().errorSummary(); track $index) {
      <p role="alert">{{ error.message }}</p>
    }
    <p role="status">{{ status() }}</p>
    <pre aria-label="Saved document">{{ saved() }}</pre>
  `,
})
export class CustomForm {
  readonly lifetime = inject(DestroyRef);
  private readonly review = inject(CUSTOM_REVIEW);
  private readonly persist = inject(CUSTOM_PERSIST);
  private readonly abort = new AbortController();
  readonly control = viewChild.required(EditorJsControl);
  readonly model = signal({ body: initialCustomDocument('Forms') });
  readonly locked = signal(false);
  readonly reviewing = signal(false);
  readonly saving = signal(false);
  readonly ready = signal(false);
  readonly status = signal('Edit the document');
  readonly saved = signal('');
  readonly config = { defaultBlock: 'callout', minHeight: 60 };
  readonly fields = form(this.model, (path) => {
    disabled(path.body, () => this.locked());
    readonlyField(path.body, () => this.reviewing());
    validate(path.body, ({ value }) => {
      // Native Forms adds symbol-keyed tracking metadata to array items.
      const normalized = normalizeOutputData(value(), { symbolKeys: 'omit' });
      if (!normalized.ok)
        return { kind: 'custom-tool', message: normalized.error.message };
      const result = validateCustomDocument(normalized.data);
      return result.ok
        ? undefined
        : { kind: 'custom-tool', message: result.errors[0].message };
    });
    validateAsync(path.body, {
      params: ({ value }) => {
        const normalized = normalizeOutputData(value(), { symbolKeys: 'omit' });
        return normalized.ok ? normalized.data : undefined;
      },
      factory: (params) =>
        resource({
          params,
          loader: ({ params, abortSignal }) => this.review(params, abortSignal),
        }),
      onSuccess: (accepted) =>
        accepted
          ? undefined
          : { kind: 'review', message: 'Review rejected the document' },
      onError: () => ({ kind: 'review', message: 'Review could not complete' }),
    });
  });
  constructor() {
    this.lifetime.onDestroy(() => this.abort.abort());
  }
  onError(event: EditorJsErrorEvent) {
    if (!this.lifetime.destroyed)
      this.status.set(`${event.operation}: ${event.code}`);
  }
  reset() {
    this.fields().reset({ body: initialCustomDocument('Forms') });
    this.saved.set('');
    this.status.set('Reset');
  }
  async save() {
    if (
      !this.ready() ||
      this.saving() ||
      this.fields().pending() ||
      this.locked()
    )
      return;
    this.saving.set(true);
    try {
      const snapshot = readCustomDocument(await this.control().save());
      if (this.lifetime.destroyed) return;
      // save() reads the editor; it does not update or validate the Forms model.
      // Tab indentation can change Code without an upstream change notification.
      if (
        JSON.stringify(snapshot.blocks) !==
        JSON.stringify(this.model().body.blocks)
      ) {
        this.model.set({ body: snapshot });
        this.status.set('Snapshot refreshed; review it and save again');
        return;
      }
      await submit(this.fields, {
        ignoreValidators: 'none',
        action: async () => {
          const accepted = await this.persist(snapshot, this.abort.signal);
          if (this.lifetime.destroyed) return undefined;
          if (!accepted)
            return [
              {
                fieldTree: this.fields.body,
                kind: 'save',
                message: 'Save failed; your edits are retained',
              },
            ];
          this.saved.set(JSON.stringify(snapshot));
          this.status.set('Saved locally');
          return undefined;
        },
      });
    } catch (error) {
      if (!this.lifetime.destroyed) this.status.set(String(error));
    } finally {
      if (!this.lifetime.destroyed) this.saving.set(false);
    }
  }
}

@Component({
  selector: 'app-custom-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<h1>Custom tool form</h1><section #holder aria-label="Form editor"><ng-container #slot /></section>',
})
export class CustomFormPage {
  readonly parent = inject(EnvironmentInjector);
  readonly lifetime = inject(DestroyRef);
  readonly holder = viewChild.required<ElementRef<HTMLElement>>('holder');
  readonly slot = viewChild.required('slot', { read: ViewContainerRef });
  constructor() {
    afterNextRender(() => {
      const environment = customEnvironment(
        this.parent,
        this.holder().nativeElement,
        'Forms',
      );
      const component = this.slot().createComponent(CustomForm, {
        environmentInjector: environment.injector,
      });
      this.lifetime.onDestroy(() => {
        component.destroy();
        environment.destroy();
      });
    });
  }
}
```

Bootstrap `CustomFormPage` with an `<app-custom-form-page>` index host. Keep its
module out of Forms-absent applications. The provider/helper modules above have
no Forms imports. Bind disabled/readonly through schema rules, never by writing
the control's Forms-owned inputs. Reset through `fields().reset(...)`, not just
the value signal. Programmatic changes do not fabricate touch/dirty events.
Forms model validation explicitly omits Angular's symbol-keyed tracking metadata
through `normalizeOutputData`; all other JSON and tool checks stay strict. The
neutral validator and saved snapshots do not opt out of symbol-key validation.

Native `pending` describes asynchronous validation. Editor load/save/readonly
failures belong to the typed operational error channel; they do not become
validation pending. `saving` fences this host's snapshot/persistence operation,
while native `submitting` belongs to `submit`. The snapshot refresh branch
deliberately asks for another save after the current value is reviewed; it avoids
submitting a Code edit that bypassed the model's async validation. Persistence
receives the captured, validated document, and failure retains edits.

These controls use non-submitting buttons and no native form, so click and Enter
cannot leak content through a pre-hydration GET. An application that introduces
a form must define its native fallback and hydration strategy explicitly.
This example adds no upload transport, public renderer or storage schema; retain
the README's upload/operation policies and authored/missing/decorative alt rules
when composing image tools.
