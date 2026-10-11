import type {
  EditorJsChangeEvent,
  EditorJsErrorEvent,
} from './editor-contracts.js';
import type { OutputData } from './output-data.js';
import { normalizeOutputData } from './parse-output-data.js';

/** Non-DOM driver for one editor. The owner supplies readiness and destruction. */
export interface EditorJsDocumentDriver {
  save(): Promise<unknown>;
  render(data: OutputData): Promise<void>;
}

export interface EditorJsDocumentCoordinatorOptions {
  readonly driver: EditorJsDocumentDriver;
  /** Synchronous event sinks; hosts must handle their own listener exceptions. */
  readonly onChange: (event: EditorJsChangeEvent) => void;
  readonly onError: (event: EditorJsErrorEvent) => void;
}

/**
 * Per-owner document coordination, independent of Editor.js and any framework.
 * Replacements are copied on acceptance and serialized with automatic saves.
 * This does not own an editor, its readiness promise, or its destruction API.
 */
export class EditorJsDocumentCoordinator {
  readonly #options: EditorJsDocumentCoordinatorOptions;
  readonly #replacements: OutputData[] = [];
  #ready = false;
  #destroyed = false;
  #running = false;
  #rendering = false;
  #dirty = false;
  #revision = 0;
  #sequence = 0;
  #fingerprint: string | undefined;
  #needsBaseline = false;

  constructor(options: EditorJsDocumentCoordinatorOptions) {
    this.#options = options;
  }

  /** Activate once the owner's editor is usable. Pre-ready edits are ignored. */
  markReady(): void {
    if (this.#destroyed || this.#ready) return;
    this.#ready = true;
    this.#schedule();
  }

  /**
   * Accept a replacement, including before readiness. Undefined clears content;
   * other invalid values report core diagnostics and leave accepted work intact.
   */
  replace(data: unknown): void {
    if (this.#destroyed) return;
    const result = normalizeOutputData(
      data === undefined ? { blocks: [] } : data,
    );
    if (!result.ok) {
      this.#report({
        operation: 'data',
        code: 'invalid-data',
        cause: result.error,
      });
      return;
    }
    this.#revision++;
    this.#dirty = false;
    this.#replacements.push(result.data);
    this.#schedule();
  }

  /** Raw editor invalidation, not proof of a physical user gesture. */
  notifyChange(): void {
    if (
      this.#destroyed ||
      !this.#ready ||
      this.#rendering ||
      this.#replacements.length > 0
    )
      return;
    this.#revision++;
    this.#sequence++;
    this.#dirty = true;
    this.#schedule();
  }

  /** Cancel unstarted work and all future outputs; in-flight driver work cannot be cancelled. */
  dispose(): void {
    this.#destroyed = true;
    this.#replacements.length = 0;
    this.#dirty = false;
    this.#fingerprint = undefined;
  }

  #schedule(): void {
    if (!this.#ready || this.#destroyed || this.#running) return;
    this.#running = true;
    // Coalesce notifications in the same turn without a timer or DOM dependency.
    void Promise.resolve().then(() => this.#drain());
  }

  async #drain(): Promise<void> {
    try {
      while (!this.#destroyed) {
        const replacement = this.#replacements.shift();
        if (replacement !== undefined) {
          await this.#render(replacement);
        } else if (this.#dirty) {
          this.#dirty = false;
          await this.#save();
        } else break;
      }
    } finally {
      this.#running = false;
    }
  }

  async #render(data: OutputData): Promise<void> {
    this.#rendering = true;
    // Even failed upstream renders can partially modify content. Re-establish a
    // baseline before publishing changes from an uncertain document state.
    this.#needsBaseline = true;
    try {
      await this.#options.driver.render(data);
      if (!this.#destroyed) await this.#save();
    } catch (cause) {
      this.#report({ operation: 'render', code: 'operation-failed', cause });
    } finally {
      this.#rendering = false;
    }
  }

  async #save(): Promise<void> {
    const revision = this.#revision;
    const sequence = this.#sequence;
    try {
      const saved = await this.#options.driver.save();
      if (this.#destroyed || revision !== this.#revision) return;
      const result = normalizeOutputData(saved);
      if (!result.ok) {
        this.#report({
          operation: 'save',
          code: 'invalid-data',
          cause: result.error,
        });
        return;
      }
      const fingerprint = documentFingerprint(result.data);
      const silent = this.#needsBaseline || fingerprint === this.#fingerprint;
      this.#needsBaseline = false;
      this.#fingerprint = fingerprint;
      if (!silent) this.#options.onChange({ data: result.data, sequence });
    } catch (cause) {
      this.#report({ operation: 'save', code: 'operation-failed', cause });
    }
  }

  #report(event: EditorJsErrorEvent): void {
    if (!this.#destroyed) this.#options.onError(event);
  }
}

/** Ignore save timestamps and object key order, preserving all other JSON fields. */
function documentFingerprint(data: OutputData): string {
  const { time: _time, ...content } = data;
  return JSON.stringify(content, (_key, value) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      );
    }
    return value;
  });
}
