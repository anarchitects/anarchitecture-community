import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  computed,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
  type OnChanges,
  type OnInit,
  type SimpleChanges,
} from '@angular/core';
import type { FormValueControl, ValidationError } from '@angular/forms/signals';
import { EditorJs, type EditorJsConfig } from '@anarchitects/editorjs-angular';
import {
  normalizeOutputData,
  type EditorJsChangeEvent,
  type EditorJsErrorEvent,
  type EditorJsReadyEvent,
  type OutputData,
} from '@anarchitects/editorjs-core';
import type { EditorJsControlConfig } from './editorjs-control-config.js';

@Component({
  selector: 'aa-editorjs-control',
  imports: [EditorJs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[attr.aria-disabled]': 'disabled() || null',
    '[attr.data-invalid]': 'invalid() || null',
    '[attr.aria-busy]': 'pending() || modePending() || null',
    '[attr.data-readonly]': 'readonly() || null',
    '[attr.data-required]': 'required() || null',
    '[attr.tabindex]': 'readonly() && !interactionBlocked() ? 0 : -1',
    '(focusin)': 'onFocusIn($event)',
    '(focusout)': 'onFocusOut($event)',
  },
  template: `
    <div [inert]="interactionBlocked()">
      @if (editorData(); as document) {
        <aa-editorjs
          [data]="document"
          [config]="editorConfig()"
          (ready)="onReady()"
          (change)="acceptChange($event)"
          (error)="error.emit($event)"
        />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class EditorJsControl
  implements FormValueControl<OutputData>, OnChanges, OnInit
{
  readonly value = model<OutputData>({ blocks: [] });
  readonly config = input<EditorJsControlConfig>();
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly pending = input(false);
  readonly touched = input(false);
  readonly dirty = input(false);
  readonly required = input(false);
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  readonly name = input('');
  readonly touch = output<void>();
  readonly ready = output<EditorJsReadyEvent>();
  // eslint-disable-next-line @angular-eslint/no-output-native -- Same saved-document channel as the standalone component.
  readonly change = output<EditorJsChangeEvent>();
  // eslint-disable-next-line @angular-eslint/no-output-native -- Same typed operation errors as the standalone component.
  readonly error = output<EditorJsErrorEvent>();

  // Only inbound writes reach the child. The form remains the value owner.
  protected readonly editorData = signal<OutputData | undefined>(undefined);
  protected readonly editorConfig = signal<EditorJsConfig | undefined>(
    undefined,
  );
  protected readonly modePending = signal(false);
  readonly #modeFailed = signal(false);
  protected readonly interactionBlocked = computed(
    () =>
      !this.#ready() ||
      this.disabled() ||
      this.modePending() ||
      this.#modeFailed(),
  );
  private readonly editor = viewChild(EditorJs);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  #configured = false;
  #initialReadOnly = false;
  #appliedReadOnly = false;
  readonly #ready = signal(false);
  #modeRequest = 0;
  #focusEpoch = 0;
  #focused = false;
  #published: OutputData | undefined;
  #inputSeen = false;
  #validInput = false;
  #destroyed = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      this.#destroyed = true;
      this.#forgetFocus();
    });
    afterRenderEffect(() => {
      if (!this.interactionBlocked()) return;
      this.#forgetFocus();
      const active = this.#host.ownerDocument.activeElement;
      if (this.#contains(active)) (active as HTMLElement).blur?.();
    });
    afterNextRender(() => {
      // Capture before editor/tool listeners, including synthetic events in inert regions.
      const gate = (event: Event) => {
        if (!this.interactionBlocked()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      const events = [
        'pointerdown',
        'pointerup',
        'mousedown',
        'mouseup',
        'touchstart',
        'click',
        'dblclick',
        'keydown',
        'keyup',
        'beforeinput',
        'input',
        'paste',
        'cut',
        'drop',
      ];
      for (const event of events)
        this.#host.addEventListener(event, gate, {
          capture: true,
          passive: false,
        });
      destroyRef.onDestroy(() => {
        for (const event of events)
          this.#host.removeEventListener(event, gate, true);
      });
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && this.#configured) {
      this.editorConfig.set({
        ...this.config(),
        readOnly: this.#initialReadOnly,
      });
    }
    if (changes['disabled'] || changes['readonly']) {
      this.#forgetFocus();
      this.#syncAvailability();
    }
    if (changes['value']) {
      this.#inputSeen = true;
      this.#project(this.value());
    }
  }

  ngOnInit(): void {
    if (!this.#inputSeen) this.#project(this.value());
  }

  /** Angular's synchronous hook; options cannot be forwarded to Editor.js focus. */
  focus(options?: FocusOptions): void {
    void options;
    if (this.#destroyed || !this.#ready() || this.interactionBlocked()) return;
    if (this.readonly()) {
      this.#host.focus();
      return;
    }
    const editor = this.editor();
    if (!editor) return;
    void editor.api.focus().then(
      (focused) => {
        if (!focused && !this.#destroyed) {
          this.error.emit({
            operation: 'focus',
            code: 'operation-failed',
            cause: new Error('Editor did not accept focus.'),
          });
        }
      },
      () => {
        /* The child already reports operation errors. */
      },
    );
  }

  protected onReady(): void {
    if (this.#destroyed) return;
    this.#ready.set(true);
    this.#appliedReadOnly = this.#initialReadOnly;
    this.modePending.set(false);
    this.#syncAvailability();
    this.ready.emit();
  }

  protected onFocusIn(event: FocusEvent): void {
    if (this.interactionBlocked()) {
      this.#forgetFocus();
      // Defend against programmatic focus in environments that do not enforce inert.
      const target = event.target as HTMLElement | null;
      target?.blur?.();
      return;
    }
    this.#focused = true;
    this.#focusEpoch++;
  }

  protected onFocusOut(event: FocusEvent): void {
    if (!this.#focused || this.interactionBlocked() || this.#destroyed) return;
    if (this.#contains(event.relatedTarget)) return;
    const epoch = this.#focusEpoch;
    // relatedTarget may be null during toolbar focus changes; inspect final focus.
    queueMicrotask(() => {
      if (
        this.#destroyed ||
        epoch !== this.#focusEpoch ||
        this.interactionBlocked()
      )
        return;
      if (this.#contains(this.#host.ownerDocument.activeElement)) return;
      // Replacing editor DOM can detach the former focus target without user exit.
      if (!(event.target as Node | null)?.isConnected) {
        this.#forgetFocus();
        return;
      }
      this.#forgetFocus();
      this.touch.emit();
    });
  }

  #contains(target: EventTarget | null): boolean {
    const NodeType = this.#host.ownerDocument.defaultView?.Node;
    return (
      !!NodeType && target instanceof NodeType && this.#host.contains(target)
    );
  }

  #forgetFocus(): void {
    this.#focused = false;
    this.#focusEpoch++;
  }

  #syncAvailability(): void {
    const editor = this.editor();
    if (!this.#ready() || !editor || this.#destroyed) return;
    const requested = this.disabled() || this.readonly();
    if (
      !this.modePending() &&
      !this.#modeFailed() &&
      requested === this.#appliedReadOnly
    )
      return;
    const request = ++this.#modeRequest;
    this.modePending.set(true);
    void editor.api.setReadOnly(requested).then(
      (actual) => {
        if (this.#destroyed || request !== this.#modeRequest) return;
        this.#appliedReadOnly = actual;
        this.#modeFailed.set(actual !== requested);
        this.modePending.set(false);
        if (actual !== requested) {
          this.error.emit({
            operation: 'readOnly',
            code: 'operation-failed',
            cause: new Error('Editor did not apply the requested mode.'),
          });
        }
      },
      () => {
        if (this.#destroyed || request !== this.#modeRequest) return;
        this.#modeFailed.set(true);
        this.modePending.set(false);
        // Keep interaction blocked. A later availability change can explicitly retry.
      },
    );
  }

  protected acceptChange(event: EditorJsChangeEvent): void {
    if (this.#destroyed || !this.#validInput) return;
    // Forms can attach tracking metadata to the model. Keep the public event detached.
    const result = normalizeOutputData(event.data);
    if (!result.ok) {
      this.error.emit({
        operation: 'data',
        code: 'invalid-data',
        cause: result.error,
      });
      return;
    }
    this.#published = result.data;
    this.value.set(result.data);
    // A model listener can synchronously remove this control.
    if (!this.#destroyed) this.change.emit(event);
  }

  #project(value: OutputData): void {
    if (value === this.#published && this.#validInput) return;
    this.#published = undefined;
    // Signal Forms decorates array items with symbol-keyed identity metadata.
    const result = normalizeOutputData(value, { symbolKeys: 'omit' });
    this.#validInput = result.ok;
    if (!result.ok) {
      this.error.emit({
        operation: 'data',
        code: 'invalid-data',
        cause: result.error,
      });
      return;
    }
    if (!this.#configured) {
      this.#configured = true;
      this.#initialReadOnly = this.disabled() || this.readonly();
      this.editorConfig.set({
        ...this.config(),
        readOnly: this.#initialReadOnly,
      });
    }
    this.editorData.set(result.data);
  }
}
