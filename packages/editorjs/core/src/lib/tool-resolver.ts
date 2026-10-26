import type { ToolConstructor } from './tool-configuration.js';
import {
  ToolRegistryError,
  type ToolReferenceContext,
  type ToolRegistry,
  type ToolRegistryEntries,
  type ToolRegistryTools,
  type ToolResolver,
} from './tool-registry-contracts.js';
import {
  getToolDefinitions,
  materializeToolMap,
  snapshotReferenceContext,
  validateToolReferences,
} from './tool-registry.js';

interface Attempt {
  readonly promise: Promise<void>;
  readonly constructors: Map<string, ToolConstructor>;
  remaining: number;
  succeed(): void;
  reject(reason: unknown): void;
}

/** Create an inert, owner-scoped resolver. Only resolve() invokes lazy loaders. */
export function createToolResolver<Entries extends ToolRegistryEntries>(
  registry: ToolRegistry<Entries>,
  context: ToolReferenceContext = {},
): ToolResolver<Entries> {
  let owner:
    | {
        registry: ToolRegistry<Entries>;
        context: ToolReferenceContext;
        definitions: ReturnType<typeof getToolDefinitions>;
      }
    | undefined = {
    registry,
    context: snapshotReferenceContext(context),
    definitions: getToolDefinitions(registry),
  };
  let current: Attempt | undefined;
  let cache: ReadonlyMap<string, ToolConstructor> | undefined;
  let disposed: ToolRegistryError | undefined;

  const reject = (attempt: Attempt, error: ToolRegistryError) => {
    if (current !== attempt) return;
    current = undefined;
    attempt.constructors.clear();
    attempt.reject(error);
  };
  const complete = (attempt: Attempt) => {
    if (current !== attempt || attempt.remaining !== 0) return;
    cache = attempt.constructors;
    current = undefined;
    attempt.succeed();
  };

  return Object.freeze({
    resolve(): Promise<ToolRegistryTools<Entries>> {
      if (!owner) return Promise.reject(disposed);
      let attempt = current;
      if (!cache && !attempt) {
        try {
          validateToolReferences(owner.registry, owner.context);
          // Promise resolution would call a direct tool class at the key "then".
          // Configured/lazy registrations produce objects and remain safe here.
          const thenTool = owner.definitions.find(
            (entry) =>
              entry.name === 'then' &&
              entry.source === 'eager' &&
              typeof entry.registration === 'function',
          );
          if (thenTool)
            throw new ToolRegistryError(
              'invalid-definition',
              ['tools', 'then', 'registration'],
              'then',
            );
        } catch (error) {
          return Promise.reject(error);
        }
        let succeed!: () => void;
        let fail!: (reason: unknown) => void;
        const promise = new Promise<void>((resolve, reject) => {
          succeed = resolve;
          fail = reject;
        });
        attempt = {
          promise,
          constructors: new Map(),
          remaining: owner.definitions.filter(
            (entry) => entry.source === 'lazy',
          ).length,
          succeed,
          reject: fail,
        };
        // Publish before invoking host code: reentrant calls must join this attempt.
        current = attempt;
        const started = attempt;
        for (const entry of owner.definitions) {
          if (current !== started) break;
          if (entry.source !== 'lazy') continue;
          const name = entry.name;
          const failed = (cause: unknown) =>
            reject(
              started,
              new ToolRegistryError(
                'load-failed',
                ['tools', name, 'load'],
                name,
                { cause },
              ),
            );
          try {
            // Observe both branches even after failure/disposal. Dynamic import
            // cannot be cancelled, and stale siblings must never revive state.
            void Promise.resolve(entry.load()).then((tool) => {
              if (current !== started) return;
              if (typeof tool !== 'function') {
                reject(
                  started,
                  new ToolRegistryError(
                    'invalid-loaded-constructor',
                    ['tools', name, 'load'],
                    name,
                    { cause: tool },
                  ),
                );
                return;
              }
              started.constructors.set(name, tool);
              started.remaining--;
              complete(started);
            }, failed);
          } catch (cause) {
            failed(cause);
          }
        }
        complete(started); // Empty/eager-only selections complete without loading.
      }
      return (attempt?.promise ?? Promise.resolve()).then(() => {
        // A successful attempt may settle just before its owner is disposed.
        if (!owner || !cache) throw disposed;
        return materializeToolMap(
          owner.definitions,
          cache,
        ) as ToolRegistryTools<Entries>;
      });
    },
    dispose(): void {
      if (disposed) return;
      disposed = new ToolRegistryError('disposed', ['resolver']);
      owner = undefined;
      cache = undefined;
      if (current) reject(current, disposed);
    },
  });
}
