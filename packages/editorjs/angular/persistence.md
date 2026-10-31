# Load, edit and save a portable notebook

These complete application recipes use the neutral codec, migration policy and
service shipped with core. Choose the standalone editor or optional native Signal
Forms control. Both supply a local repository, explicit save/reload actions and
failure controls. They store only a document and host metadata; no signals, form
trees or controls cross the service boundary.

The repository is bounded, in-memory and owned by one page instance. Reload reads
that repository; refreshing the browser or destroying the page loses its data.
This is not durable browser storage, remote persistence or server authorization.
The local principal is demonstration context, not a credential. A real server
must validate and authorize again and implement transactional revision checks.

## Installation and files

Start with an Angular 22 application using the [README installation](README.md#installation-and-prerequisites).
Install core and Angular together, using their supplied archives before release:

```sh
npm install /absolute/path/to/anarchitects-editorjs-core-0.0.1.tgz /absolute/path/to/anarchitects-editorjs-angular-0.0.1.tgz @editorjs/editorjs@2.31.7
```

Copy these complete application files into one directory, such as `src/app/notebook`:

- From core's `persistence.md`: `persistence.ts` and `evolution.ts`.
- From core's `service.md`: `notebook-service.ts`.
- From core's `custom-tools.md`, into a `custom` subdirectory: `callout-data.ts`,
  `callout-tool.ts`, `editorial-data.ts` and `flag-tune.ts`.
- From this guide: `notebook-browser.ts` and either `notebook-editor.ts` or
  `notebook-form.ts` below.

The source guides are in `node_modules/@anarchitects/editorjs-core`. Keep these
shared files unchanged: they contain the single mapping, validation and migration
implementation. The application uses built-in paragraphs plus the copied callout
and flag tune. It does not enable arbitrary tools or extend the notebook schema.

For standalone consumption, replace your browser `src/main.ts` with:

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { NotebookEditor } from './app/notebook/notebook-editor';

bootstrapApplication(NotebookEditor).catch(console.error);
```

Use `<app-notebook-editor></app-notebook-editor>` as the index host, then run
your application's normal build/serve commands (`ng build`, `ng serve` in a CLI
application). Click **Open notebook**, edit the first paragraph, **Save notebook**,
make another edit, and **Reload notebook**. The acknowledged revision increments;
reload restores the acknowledged document. **Fail next save** demonstrates
retained drafts; **Hold next save** and **Complete held save** let you edit while
persistence is outstanding. **Simulate another writer** makes your revision stale.

## Shared browser composition

The helper below composes the supplied repository and service; it does not
serialize or migrate content itself. The optional hold affects one write only.
Disposal releases held work and the owning page ignores late results; release or
request cancellation does not imply rollback. Each page creates its own demo
after explicit browser activation, never at module scope or on the server.

<!-- persistence-angular-file: notebook-browser.ts -->

```ts
import type { EditorJsConfig } from '@anarchitects/editorjs-angular';
import type { OutputData } from '@anarchitects/editorjs-core';
import { requireNotebookForEditing } from './evolution.js';
import { type NotebookRecord } from './persistence.js';
import {
  MemoryNotebookRepository,
  NotebookService,
} from './notebook-service.js';

export function editingSnapshot(
  document: unknown,
  record: NotebookRecord,
): OutputData {
  return requireNotebookForEditing({ ...record, document }).document;
}
// Editor.js save timestamps are not authored edits. Compare the editable blocks.
export const sameBlocks = (left: OutputData, right: OutputData) =>
  JSON.stringify(left.blocks) === JSON.stringify(right.blocks);

export async function notebookConfig(): Promise<
  Omit<EditorJsConfig, 'readOnly'> & { readOnly?: never }
> {
  const [{ CalloutTool }, { FlagTune }] = await Promise.all([
    import('./custom/callout-tool.js'),
    import('./custom/flag-tune.js'),
  ]);
  return {
    minHeight: 80,
    tools: { callout: { class: CalloutTool }, flag: { class: FlagTune } },
    tunes: ['flag'],
  };
}

export class NotebookDemo {
  readonly repository = new MemoryNotebookRepository();
  private hold = false;
  private releaseWrite: (() => void) | undefined;
  readonly service = new NotebookService(
    {
      read: (id) => this.repository.read(id),
      commit: async (record, revision) => {
        if (this.hold) {
          this.hold = false;
          await new Promise<void>((resolve) => {
            this.releaseWrite = resolve;
          });
        }
        return this.repository.commit(record, revision);
      },
    },
    (principal) => principal === 'local-example',
  );

  holdNextSave() {
    this.hold = true;
  }
  completeSave() {
    this.hold = false;
    this.releaseWrite?.();
    this.releaseWrite = undefined;
  }
  failNextSave() {
    this.repository.failNextWrite();
  }
  dispose() {
    this.completeSave();
  }

  async initialize() {
    // Trusted fixture import, including intentionally unsupported archival data.
    // An untrusted request must go through NotebookService instead.
    for (const [id, version, text] of [
      ['note-1', '2', 'First notebook'],
      ['note-2', '2', 'Second notebook'],
      ['legacy', '1', 'Legacy notebook'],
      ['future', 'future', 'Retained original'],
    ]) {
      await this.repository.commit(
        {
          id,
          revision: 'imported',
          document: {
            blocks: [
              {
                type: version === '1' ? 'aside' : 'paragraph',
                data:
                  version === '1' ? { message: text, tone: 'info' } : { text },
              },
            ],
          },
          provenance: { schema: { id: 'example/editorial-notebook', version } },
        },
        null,
      );
    }
  }
  async anotherWriter(id: string) {
    const loaded = await this.service.load('local-example', id);
    if (!loaded.ok) return loaded;
    const record = loaded.value.record;
    return this.service.save('local-example', {
      id,
      expectedRevision: record.revision,
      provenance: record.provenance,
      document: {
        blocks: [{ type: 'paragraph', data: { text: 'Another writer' } }],
      },
    });
  }
}
```

## Standalone editor

Only load operations replace the editor input. Change notifications mark local
edits, never store them. Save captures a fresh public `api.save()` snapshot,
validates it with the shared editing gate and submits it with the loaded revision.
One save runs at a time. Edits remain available while storage is pending.

<!-- persistence-angular-file: notebook-editor.ts -->

```ts
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { EditorJs, type EditorJsConfig } from '@anarchitects/editorjs-angular';
import type {
  EditorJsErrorEvent,
  OutputData,
} from '@anarchitects/editorjs-core';
import { encodeRecord, type NotebookRecord } from './persistence.js';
import {
  editingSnapshot,
  sameBlocks,
  notebookConfig,
  NotebookDemo,
} from './notebook-browser.js';

@Component({
  selector: 'app-notebook-editor',
  imports: [EditorJs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Portable notebook</h1>
    <button
      type="button"
      [disabled]="!hydrated() || started()"
      (click)="open()"
    >
      Open notebook
    </button>
    @if (config(); as editorConfig) {
      <section
        aria-label="Notebook editor"
        [inert]="loading()"
        (input)="edited()"
        (keydown)="edited()"
        (click)="edited()"
      >
        <aa-editorjs
          [config]="editorConfig"
          [data]="initial()"
          (ready)="ready.set(true)"
          (change)="edited()"
          (error)="onError($event)"
        />
      </section>
      <button
        type="button"
        [disabled]="!ready() || busy() || loading() || blocked()"
        (click)="save()"
      >
        Save notebook
      </button>
      <button type="button" [disabled]="loading()" (click)="load(record()!.id)">
        Reload notebook
      </button>
      <button type="button" (click)="load('note-2')">
        Load other notebook
      </button>
      <button type="button" (click)="load('legacy')">
        Load legacy notebook
      </button>
      <button type="button" (click)="load('future')">
        Load unsupported notebook
      </button>
      <button type="button" [disabled]="busy()" (click)="demo!.failNextSave()">
        Fail next save
      </button>
      <button type="button" [disabled]="busy()" (click)="demo!.holdNextSave()">
        Hold next save
      </button>
      <button type="button" (click)="demo!.completeSave()">
        Complete held save
      </button>
      <button type="button" [disabled]="busy()" (click)="anotherWriter()">
        Simulate another writer
      </button>
    }
    <p role="status">{{ status() }}</p>
    <p aria-label="Persistence pending">{{ busy() }}</p>
    <p aria-label="Unsaved edits">{{ unsaved() }}</p>
    <p aria-label="Loaded notebook">{{ record()?.id }}</p>
    <p aria-label="Revision">{{ record()?.revision }}</p>
    @if (operationError()) {
      <p role="alert">{{ operationError() }}</p>
    }
    <pre aria-label="Acknowledged record">{{ acknowledged() }}</pre>
  `,
})
export class NotebookEditor {
  private readonly lifetime = inject(DestroyRef);
  readonly editor = viewChild(EditorJs);
  readonly hydrated = signal(false);
  readonly started = signal(false);
  readonly ready = signal(false);
  readonly config = signal<EditorJsConfig | undefined>(undefined);
  readonly initial = signal<OutputData>({ blocks: [] });
  readonly record = signal<NotebookRecord | undefined>(undefined);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly blocked = signal(false);
  readonly unsaved = signal(false);
  readonly status = signal('Open the local notebook');
  readonly operationError = signal('');
  readonly acknowledged = signal('');
  demo: NotebookDemo | undefined;
  private generation = 0;
  private edits = 0;

  constructor() {
    afterNextRender(() => this.hydrated.set(true));
    this.lifetime.onDestroy(() => {
      this.generation++;
      this.demo?.dispose();
    });
  }
  private current(generation: number) {
    return !this.lifetime.destroyed && generation === this.generation;
  }
  edited() {
    this.edits++;
    this.unsaved.set(true);
  }
  onError(event: EditorJsErrorEvent) {
    this.operationError.set(`Editor ${event.operation}: ${event.code}`);
  }

  async open() {
    if (!this.hydrated() || this.started()) return;
    this.started.set(true);
    this.demo = new NotebookDemo();
    try {
      await this.demo.initialize();
      const config = await notebookConfig();
      if (this.lifetime.destroyed) return;
      await this.load('note-1');
      if (!this.lifetime.destroyed) this.config.set(config);
    } catch {
      if (!this.lifetime.destroyed)
        this.status.set('Opening failed; recreate the page to retry');
    }
  }
  async load(id: string) {
    if (!this.demo || this.lifetime.destroyed) return;
    const generation = ++this.generation;
    this.loading.set(true);
    try {
      const result = await this.demo.service.load('local-example', id);
      if (!this.current(generation)) return;
      if (!result.ok) {
        this.blocked.set(true);
        this.status.set(`Load ${result.error.code}; previous draft retained`);
        return;
      }
      const record = result.value.record;
      const editor = this.editor();
      if (editor) await editor.api.render(record.document);
      else this.initial.set(record.document);
      if (!this.current(generation)) return;
      this.record.set(record);
      this.blocked.set(false);
      this.unsaved.set(false);
      this.operationError.set('');
      this.acknowledged.set('');
      this.status.set(`Loaded ${record.id} (${result.value.migration})`);
    } catch {
      if (this.current(generation)) {
        this.blocked.set(true);
        this.status.set('Load failed; previous draft retained');
      }
    } finally {
      if (this.current(generation)) this.loading.set(false);
    }
  }
  async anotherWriter() {
    const record = this.record();
    if (!record || !this.demo || this.busy()) return;
    const generation = this.generation;
    const result = await this.demo.anotherWriter(record.id);
    if (this.current(generation))
      this.status.set(
        result.ok
          ? 'Another writer committed; your revision is now stale'
          : 'Other write failed',
      );
  }
  async save() {
    const record = this.record();
    if (
      !record ||
      !this.demo ||
      !this.ready() ||
      this.busy() ||
      this.loading() ||
      this.blocked()
    )
      return;
    const generation = this.generation;
    const edits = this.edits;
    this.busy.set(true);
    this.status.set('Capturing editor snapshot');
    try {
      const snapshot = editingSnapshot(await this.editor()!.api.save(), record);
      if (!this.current(generation)) return;
      if (edits !== this.edits) {
        this.status.set('Edited during capture; save again');
        return;
      }
      this.status.set('Persisting snapshot');
      const result = await this.demo.service.save('local-example', {
        id: record.id,
        expectedRevision: record.revision,
        document: snapshot,
        provenance: record.provenance,
      });
      if (!this.current(generation)) return;
      if (!result.ok) {
        this.status.set(`Save ${result.error.code}; draft retained`);
        return;
      }
      this.record.set(result.value.record);
      this.acknowledged.set(encodeRecord(result.value.record));
      // Read the actual editor again; notifications may still be debounced.
      const displayed = await this.editor()!.api.save();
      if (!this.current(generation)) return;
      const unchanged = edits === this.edits && sameBlocks(snapshot, displayed);
      this.unsaved.set(!unchanged);
      this.status.set(
        unchanged ? 'Saved snapshot' : 'Saved snapshot; newer edits retained',
      );
    } catch {
      if (this.current(generation))
        this.status.set(
          'Snapshot operation failed; inspect editor errors and retain the draft',
        );
    } finally {
      if (!this.lifetime.destroyed) this.busy.set(false);
    }
  }
}
```

## Optional native Signal Forms

Install `@angular/forms` at the same version as Angular core (for example
`npm install @angular/forms@22.1.4`). Copy `notebook-form.ts`, bootstrap
`NotebookForm` instead of `NotebookEditor`, and use an `<app-notebook-form>` index
host. Standalone applications do not import this file or require Forms.

The form model owns only the editable body. Revision and provenance stay in the
loaded host record. Its validator delegates to the shared editing gate. Only
the Forms model boundary omits Angular's symbol-keyed tracking metadata; raw
editor snapshots and the service keep strict JSON validation.

<!-- persistence-angular-file: notebook-form.ts -->

```ts
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  InjectionToken,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import {
  form,
  FormField,
  submit,
  validate,
  validateAsync,
} from '@angular/forms/signals';
import {
  EditorJsControl,
  type EditorJsControlConfig,
} from '@anarchitects/editorjs-angular/forms';
import {
  normalizeOutputData,
  type EditorJsErrorEvent,
  type OutputData,
} from '@anarchitects/editorjs-core';
import { encodeRecord, type NotebookRecord } from './persistence.js';
import {
  editingSnapshot,
  sameBlocks,
  notebookConfig,
  NotebookDemo,
} from './notebook-browser.js';

// Optional host review; the supplied local path accepts structurally valid content.
// This is validation, never storage acknowledgement or server authorization.
export const NOTEBOOK_REVIEW = new InjectionToken<
  (document: OutputData, signal: AbortSignal) => Promise<boolean>
>('notebook review', { providedIn: 'root', factory: () => async () => true });

@Component({
  selector: 'app-notebook-form',
  imports: [EditorJsControl, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Portable notebook with Signal Forms</h1>
    <button
      type="button"
      [disabled]="!hydrated() || started()"
      (click)="open()"
    >
      Open notebook
    </button>
    @if (config(); as editorConfig) {
      <section
        aria-label="Notebook editor"
        [inert]="loading()"
        (input)="edited()"
        (keydown)="edited()"
        (click)="edited()"
      >
        <aa-editorjs-control
          aria-label="Notebook body"
          [formField]="fields.body"
          [config]="editorConfig"
          (ready)="ready.set(true)"
          (error)="onError($event)"
        />
      </section>
      <button
        type="button"
        [disabled]="
          !ready() || busy() || loading() || blocked() || fields().pending()
        "
        (click)="save()"
      >
        Save notebook
      </button>
      <button type="button" [disabled]="loading()" (click)="load(record()!.id)">
        Reload notebook
      </button>
      <button type="button" (click)="load('note-2')">
        Load other notebook
      </button>
      <button type="button" (click)="load('legacy')">
        Load legacy notebook
      </button>
      <button type="button" (click)="load('future')">
        Load unsupported notebook
      </button>
      <button type="button" [disabled]="busy()" (click)="demo!.failNextSave()">
        Fail next save
      </button>
      <button type="button" [disabled]="busy()" (click)="demo!.holdNextSave()">
        Hold next save
      </button>
      <button type="button" (click)="demo!.completeSave()">
        Complete held save
      </button>
      <button type="button" [disabled]="busy()" (click)="anotherWriter()">
        Simulate another writer
      </button>
      @for (error of fields().errorSummary(); track $index) {
        <p role="alert">{{ error.message }}</p>
      }
    }
    <p role="status">{{ status() }}</p>
    <p aria-label="Persistence pending">{{ busy() }}</p>
    <p aria-label="Validation pending">{{ fields().pending() }}</p>
    <p aria-label="Submitting">{{ fields().submitting() }}</p>
    <p aria-label="Dirty">{{ fields.body().dirty() }}</p>
    <p aria-label="Touched">{{ fields.body().touched() }}</p>
    <p aria-label="Loaded notebook">{{ record()?.id }}</p>
    <p aria-label="Revision">{{ record()?.revision }}</p>
    @if (operationError()) {
      <p role="alert">{{ operationError() }}</p>
    }
    <pre aria-label="Acknowledged record">{{ acknowledged() }}</pre>
    <pre aria-label="Draft document">{{ modelJson() }}</pre>
  `,
})
export class NotebookForm {
  private readonly lifetime = inject(DestroyRef);
  private readonly review = inject(NOTEBOOK_REVIEW);
  readonly editor = viewChild(EditorJsControl);
  readonly hydrated = signal(false);
  readonly started = signal(false);
  readonly ready = signal(false);
  readonly config = signal<EditorJsControlConfig | undefined>(undefined);
  readonly record = signal<NotebookRecord | undefined>(undefined);
  readonly model = signal<{ body: OutputData }>({ body: { blocks: [] } });
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly blocked = signal(false);
  readonly status = signal('Open the local notebook');
  readonly operationError = signal('');
  readonly acknowledged = signal('');
  demo: NotebookDemo | undefined;
  private generation = 0;
  private edits = 0;
  readonly fields = form(this.model, (path) => {
    validate(path.body, ({ value }) => {
      if (!this.record()) return undefined;
      try {
        this.modelSnapshot(value());
        return undefined;
      } catch {
        return {
          kind: 'notebook',
          message: 'Document is not supported for notebook editing',
        };
      }
    });
    validateAsync(path.body, {
      params: ({ value }) => {
        if (!this.record()) return undefined;
        try {
          return this.modelSnapshot(value());
        } catch {
          return undefined;
        }
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
    afterNextRender(() => this.hydrated.set(true));
    this.lifetime.onDestroy(() => {
      this.generation++;
      this.demo?.dispose();
    });
  }
  private current(generation: number) {
    return !this.lifetime.destroyed && generation === this.generation;
  }
  private modelSnapshot(value: unknown): OutputData {
    const normalized = normalizeOutputData(value, { symbolKeys: 'omit' });
    if (!normalized.ok) throw new Error('Invalid form document');
    return editingSnapshot(normalized.data, this.record()!);
  }
  modelJson() {
    return JSON.stringify(this.model().body);
  }
  edited() {
    this.edits++;
  }
  onError(event: EditorJsErrorEvent) {
    this.operationError.set(`Editor ${event.operation}: ${event.code}`);
  }
  async open() {
    if (!this.hydrated() || this.started()) return;
    this.started.set(true);
    this.demo = new NotebookDemo();
    try {
      await this.demo.initialize();
      const config = await notebookConfig();
      if (this.lifetime.destroyed) return;
      await this.load('note-1');
      if (!this.lifetime.destroyed) this.config.set(config);
    } catch {
      if (!this.lifetime.destroyed)
        this.status.set('Opening failed; recreate the page to retry');
    }
  }
  async load(id: string) {
    if (!this.demo || this.lifetime.destroyed) return;
    const generation = ++this.generation;
    this.loading.set(true);
    const result = await this.demo.service.load('local-example', id);
    if (!this.current(generation)) return;
    this.loading.set(false);
    if (!result.ok) {
      this.blocked.set(true);
      this.status.set(`Load ${result.error.code}; previous draft retained`);
      return;
    }
    this.record.set(result.value.record);
    this.fields().reset({ body: result.value.record.document });
    this.blocked.set(false);
    this.operationError.set('');
    this.acknowledged.set('');
    this.status.set(`Loaded ${id} (${result.value.migration})`);
  }
  async anotherWriter() {
    const record = this.record();
    if (!record || !this.demo || this.busy()) return;
    const generation = this.generation;
    const result = await this.demo.anotherWriter(record.id);
    if (this.current(generation))
      this.status.set(
        result.ok
          ? 'Another writer committed; your revision is now stale'
          : 'Other write failed',
      );
  }
  async save() {
    const record = this.record();
    if (
      !record ||
      !this.demo ||
      !this.ready() ||
      this.busy() ||
      this.loading() ||
      this.blocked() ||
      this.fields().pending()
    )
      return;
    const generation = this.generation;
    const edits = this.edits;
    this.busy.set(true);
    this.status.set('Capturing editor snapshot');
    let writeFailure: string | undefined;
    try {
      const snapshot = editingSnapshot(await this.editor()!.save(), record);
      if (!this.current(generation)) return;
      if (edits !== this.edits) {
        this.status.set('Edited during capture; save again');
        return;
      }
      // Explicit save can discover an edit that emitted no upstream notification.
      if (!sameBlocks(snapshot, this.modelSnapshot(this.model().body))) {
        this.model.set({ body: snapshot });
        this.status.set(
          'Snapshot refreshed; wait for validation and save again',
        );
        return;
      }
      await submit(this.fields, {
        ignoreValidators: 'none',
        onInvalid: () =>
          this.status.set('Validation incomplete; draft retained'),
        action: async () => {
          this.status.set('Persisting snapshot');
          const result = await this.demo!.service.save('local-example', {
            id: record.id,
            expectedRevision: record.revision,
            document: snapshot,
            provenance: record.provenance,
          });
          if (!this.current(generation)) return undefined;
          if (!result.ok) {
            // A transient storage failure is not a validation error. Reject
            // this submission, then handle it locally without resetting fields.
            writeFailure = result.error.code;
            throw new Error('Notebook write failed');
          }
          this.record.set(result.value.record);
          this.acknowledged.set(encodeRecord(result.value.record));
          const displayed = await this.editor()!.save();
          if (!this.current(generation)) return undefined;
          const unchanged =
            edits === this.edits &&
            sameBlocks(snapshot, displayed) &&
            sameBlocks(snapshot, this.modelSnapshot(this.model().body));
          if (unchanged)
            this.fields().reset({ body: result.value.record.document });
          this.status.set(
            unchanged
              ? 'Saved snapshot; form reset'
              : 'Saved snapshot; newer edits retained',
          );
          return undefined;
        },
      });
    } catch {
      if (this.current(generation))
        this.status.set(
          writeFailure
            ? `Save ${writeFailure}; draft retained`
            : 'Snapshot operation failed; inspect editor errors and retain the draft',
        );
    } finally {
      if (!this.lifetime.destroyed) this.busy.set(false);
    }
  }
}
```

## Submission and recovery policy

- Capture an explicit editor snapshot. A change event, upload completion or review
  success is not a document acknowledgement. Duplicate saves are ignored while
  one capture/write is active. A new load increments the page generation; an old
  completion cannot replace that load, its revision or its draft.
- Edits during persistence remain editable. A successful response advances the
  stored revision, but resets native Forms only when the captured snapshot still
  matches both the displayed editor and the form model, with no intervening user
  interaction. A second explicit save persists newer edits using the new revision.
  Input/keyboard/tool interaction tracking is deliberately conservative; an
  uncertain draft remains dirty rather than being reset.
- Native `pending` belongs to async validation and native `submitting` belongs to
  `submit`. Storage failures reject the submission and are handled by the host;
  they do not become validation errors that prevent retrying an unchanged draft.
  `busy` describes this host's capture/persistence operation. Typed
  editor errors have a separate alert. This example has no uploads; composing
  uploads must preserve their own pending/retry/cancellation and owner lifetime.
  Never clear file ownership or mark document persistence successful just because
  an upload completed.
- A form snapshot that differs from its validated model is refreshed and requires
  another explicit save after validation. This also protects integrations with
  silent edits such as Code's Tab handling; Code is not part of this notebook's
  schema, and adding it requires a reviewed shared policy and tool configuration.
- Failed/unsupported loads retain the previous draft and block saving until a
  supported load succeeds. No empty fallback or implicit migration writeback is
  performed. A stale write retains the draft; reload/reconcile explicitly rather
  than retrying a blind overwrite. An external timeout may follow a commit, so
  reconcile unknown outcomes with the authoritative host.
- Loading/reloading deliberately discards the current local draft after a
  successful read. Add a confirmation flow in an application that requires it.
  Native Forms resets use `fields().reset(...)`; model assignment alone does not
  reset dirty/touched state. Acknowledgement never rewrites a newer draft.

## SSR, safety and compatibility

Both components initially render an inert opening button, disabled until
`afterNextRender`. There is no native form and every button is `type="button"`;
pre-hydration click or Enter cannot submit content through a GET or POST. Editor
tools, repository creation and seed writes occur only after explicit browser
activation. Module evaluation and server rendering do not touch browser storage,
instantiate Editor.js or share mutable request data. Destroying the component
destroys its child editor and fences all outstanding results.

For SSR, use the README's host hydration/router configuration; libraries do not
install hydration providers. Treat both components as route/parent-owned views.
Do not put credentials or a mutable singleton repository in module scope. This
guide does not provide a public renderer or authorize HTML/URL handling. Preserve
authored, missing and decorative alt intent when extending the tool profile.

The reference check uses Angular 22.1.4, matching Forms, Node 24.15.0,
TypeScript 6.0.3 and Editor.js 2.31.7 in Chromium. The standalone path compiles
without Forms installed. Broader package support in the README does not imply
every persistence recipe/version/browser combination has been exercised.

If save is unavailable, check readiness, a pending load/write, validation pending
and any unsupported-load message. If a write fails, retain the draft, inspect
the bounded status and resolve the host failure before resubmitting. If review
fails, correct the draft or retry the host review; do not bypass validation.
The core [service guide](https://github.com/anarchitects/anarchitecture-community/blob/main/packages/editorjs/core/service.md)
documents server authorization, transaction, size and storage-adapter obligations.
