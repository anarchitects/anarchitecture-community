import type { OutputBlockData, OutputData } from './output-data.js';

/**
 * Framework-neutral contract for one live editor owner's controls.
 * No controller implementation is supplied. Calls reject before ready/after
 * destruction; accepted operations run in order.
 * A typed block parameter describes validated tool data, not runtime validation.
 */
export interface EditorJsApi<Block extends OutputBlockData = OutputBlockData> {
  save(): Promise<OutputData<Block>>;
  render(data: OutputData<Block>): Promise<void>;
  clear(): Promise<void>;
  focus(atEnd?: boolean): Promise<boolean>;
  setReadOnly(readOnly: boolean): Promise<boolean>;
}

/** Readiness-only notification emitted once for a live, usable editor owner. */
export type EditorJsReadyEvent = void;

/**
 * Saved snapshot from an editor-originated change, not a programmatic replacement.
 * Sequence increases within one owner; coalescing may leave gaps.
 */
export interface EditorJsChangeEvent<
  Block extends OutputBlockData = OutputBlockData,
> {
  readonly data: OutputData<Block>;
  readonly sequence: number;
}

export type EditorJsOperation =
  | 'load'
  | 'create'
  | 'ready'
  | 'config'
  | 'data'
  | 'save'
  | 'render'
  | 'clear'
  | 'focus'
  | 'readOnly'
  | 'destroy';

/** Error output payload; preserve the original failure for host diagnostics. */
export interface EditorJsErrorEvent {
  readonly operation: EditorJsOperation;
  readonly code:
    | 'not-ready'
    | 'destroyed'
    | 'config-changed'
    | 'invalid-data'
    | 'unsupported-platform'
    | 'operation-failed';
  readonly cause: unknown;
}
