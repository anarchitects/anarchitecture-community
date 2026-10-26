import {
  type BuiltInToolProfile,
  type ComposedToolEntries,
  type ToolDefinition,
  type ToolKind,
  type ToolReferenceContext,
  type ToolRegistry,
  type ToolRegistryEntries,
  type ToolRegistryTools,
} from './tool-registry-contracts.js';
import {
  array,
  copySettings,
  definition,
  fail,
  fields,
  profile,
  toolName,
} from './tool-registry-validation.js';
import type { ToolConstructor } from './tool-configuration.js';

/** Metadata only: does not import or initialize any Editor.js tool. */
export const EDITOR_JS_2_31_7_TOOL_PROFILE: BuiltInToolProfile = profile({
  defaultBlock: 'paragraph',
  tools: [
    { name: 'paragraph', kind: 'block' },
    { name: 'stub', kind: 'block', reserved: true },
    { name: 'bold', kind: 'inline' },
    { name: 'italic', kind: 'inline' },
    { name: 'link', kind: 'inline' },
    { name: 'convertTo', kind: 'inline', reserved: true },
    { name: 'moveUp', kind: 'tune' },
    { name: 'delete', kind: 'tune' },
    { name: 'moveDown', kind: 'tune' },
  ],
});

// No process-wide registry/cache. The snapshot owns only frozen metadata.
class RegistrySnapshot {
  readonly names: readonly string[];
  readonly definitions: readonly ToolDefinition[];

  constructor(
    definitions: Iterable<ToolDefinition>,
    readonly profile: BuiltInToolProfile,
  ) {
    this.definitions = Object.freeze([...definitions]);
    this.names = Object.freeze(this.definitions.map((item) => item.name));
    Object.freeze(this);
  }
}

function snapshot(registry: unknown): RegistrySnapshot {
  if (!(registry instanceof RegistrySnapshot))
    fail('invalid-registry', ['registry']);
  return registry;
}

/** Internal access to the already validated, frozen definition containers. */
export function getToolDefinitions(
  registry: unknown,
): readonly ToolDefinition[] {
  return snapshot(registry).definitions;
}

function typed<Entries extends ToolRegistryEntries>(
  value: RegistrySnapshot,
): ToolRegistry<Entries> {
  // The opaque brand carries inferred entries without exposing mutable definitions.
  return value as unknown as ToolRegistry<Entries>;
}

function sameProfile(
  left: BuiltInToolProfile,
  right: BuiltInToolProfile,
): boolean {
  return (
    left.defaultBlock === right.defaultBlock &&
    left.tools.length === right.tools.length &&
    left.tools.every((tool) =>
      right.tools.some(
        (other) =>
          tool.name === other.name &&
          tool.kind === other.kind &&
          tool.reserved === other.reserved,
      ),
    )
  );
}

/** Compose whole definitions in order; explicit replacement never merges config. */
export function composeToolRegistry<
  const Groups extends readonly (readonly ToolDefinition[])[],
  Base extends ToolRegistryEntries = Record<never, never>,
>(
  groups: Groups,
  options: {
    readonly profile: BuiltInToolProfile;
    readonly base?: ToolRegistry<Base>;
  },
): ToolRegistry<ComposedToolEntries<Groups, Base>> {
  const config = fields(options, ['profile', 'base'], 'invalid-options', [
    'options',
  ]);
  const builtIns = profile(config['profile']);
  const entries = new Map<string, ToolDefinition>();
  if (config['base'] !== undefined) {
    const base = snapshot(config['base']);
    if (!sameProfile(base.profile, builtIns))
      fail('invalid-profile', ['options', 'base']);
    for (const entry of base.definitions) entries.set(entry.name, entry);
  }
  array(groups, 'invalid-definition', ['groups']).forEach(
    (group, groupIndex) => {
      array(group, 'invalid-definition', ['groups', groupIndex]).forEach(
        (value, index) => {
          const path = ['groups', groupIndex, index];
          const entry = definition(value, path);
          const builtIn = builtIns.tools.find(
            (tool) => tool.name === entry.name,
          );
          const previous = entries.get(entry.name) ?? builtIn;
          if (entry.replace) {
            if (!previous || previous.kind !== entry.kind || builtIn?.reserved)
              fail('invalid-replacement', path, entry.name);
          } else if (previous) fail('duplicate-name', path, entry.name);
          entries.set(entry.name, entry);
        },
      );
    },
  );
  return typed(new RegistrySnapshot(entries.values(), builtIns));
}

export function selectToolRegistry<Entries extends ToolRegistryEntries>(
  registry: ToolRegistry<Entries>,
): ToolRegistry<Entries>;
export function selectToolRegistry<
  Entries extends ToolRegistryEntries,
  const Names extends readonly (keyof Entries & string)[],
>(
  registry: ToolRegistry<Entries>,
  names: Names,
): ToolRegistry<Pick<Entries, Names[number]>>;
/** Select custom definitions only; implicit upstream built-ins remain available. */
export function selectToolRegistry(
  registry: ToolRegistry,
  names?: readonly string[],
): ToolRegistry {
  const source = snapshot(registry);
  if (names === undefined) return registry;
  const selected = new Set<string>();
  const definitions = array(names, 'invalid-selection', ['selection']).map(
    (value, index) => {
      const name = toolName(value, 'invalid-selection', ['selection', index]);
      const entry = source.definitions.find((item) => item.name === name);
      if (!entry || selected.has(name))
        fail('invalid-selection', ['selection', index], name);
      selected.add(name);
      return entry;
    },
  );
  return typed(new RegistrySnapshot(definitions, source.profile));
}

/** Check explicit names without inspecting constructors or loading code. */
export function validateToolReferences<Entries extends ToolRegistryEntries>(
  registry: ToolRegistry<Entries>,
  context: ToolReferenceContext = {},
): void {
  const source = snapshot(registry);
  const config = snapshotReferenceContext(context);
  const available = new Map<
    string,
    { readonly kind: ToolKind; readonly reserved?: true }
  >(source.profile.tools.map((tool) => [tool.name, tool]));
  for (const entry of source.definitions) available.set(entry.name, entry);
  const defaultBlock =
    config.defaultBlock || config.initialBlock || source.profile.defaultBlock;
  const defaultName = toolName(defaultBlock, 'invalid-reference', [
    'context',
    'defaultBlock',
  ]);
  const defaultTool = available.get(defaultName);
  if (defaultTool?.kind !== 'block' || defaultTool.reserved)
    fail('invalid-reference', ['context', 'defaultBlock'], defaultName);

  const check = (
    value: unknown,
    kind: ToolKind,
    path: readonly (string | number)[],
    owner?: string,
    booleanAllowed = true,
  ) => {
    if (value === undefined || (booleanAllowed && typeof value === 'boolean'))
      return;
    const seen = new Set<string>();
    array(value, 'invalid-reference', path, owner).forEach((value, index) => {
      const name = toolName(
        value,
        'invalid-reference',
        [...path, index],
        owner,
      );
      if (seen.has(name) || available.get(name)?.kind !== kind)
        fail('invalid-reference', [...path, index], owner ?? name);
      seen.add(name);
    });
  };
  check(config.inlineToolbar, 'inline', ['context', 'inlineToolbar']);
  check(config.tunes, 'tune', ['context', 'tunes'], undefined, false);
  for (const entry of source.definitions) {
    if (entry.kind !== 'block') continue;
    const settings =
      entry.source === 'lazy'
        ? entry.settings
        : typeof entry.registration === 'function'
          ? undefined
          : entry.registration;
    check(
      settings?.inlineToolbar,
      'inline',
      ['tools', entry.name, 'inlineToolbar'],
      entry.name,
    );
    check(settings?.tunes, 'tune', ['tools', entry.name, 'tunes'], entry.name);
  }
}

/** Internal context snapshot; name resolution still happens at the load boundary. */
export function snapshotReferenceContext(
  context: ToolReferenceContext,
): ToolReferenceContext {
  const config = fields(
    context,
    ['defaultBlock', 'initialBlock', 'inlineToolbar', 'tunes'],
    'invalid-options',
    ['context'],
  );
  for (const field of ['defaultBlock', 'initialBlock']) {
    if (config[field] !== undefined && typeof config[field] !== 'string')
      fail('invalid-options', ['context', field]);
  }
  for (const field of ['inlineToolbar', 'tunes']) {
    if (Array.isArray(config[field]))
      config[field] = Object.freeze(
        array(config[field], 'invalid-reference', ['context', field]),
      );
  }
  return Object.freeze(config) as ToolReferenceContext;
}

/** Materialize an eager selection. Lazy definitions fail without invoking loaders. */
export function createToolMap<Entries extends ToolRegistryEntries>(
  registry: ToolRegistry<Entries>,
  context: ToolReferenceContext = {},
): ToolRegistryTools<Entries> {
  validateToolReferences(registry, context);
  return materializeToolMap(
    snapshot(registry).definitions,
  ) as ToolRegistryTools<Entries>;
}

/** Shared internal output builder; never retains caller-facing mutable shells. */
export function materializeToolMap(
  definitions: readonly ToolDefinition[],
  constructors: ReadonlyMap<string, ToolConstructor> = new Map(),
): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null);
  for (const entry of definitions) {
    if (entry.source === 'lazy') {
      const tool = constructors.get(entry.name);
      if (!tool) fail('unresolved-tool', ['tools', entry.name], entry.name);
      result[entry.name] = {
        ...copySettings(entry.settings ?? {}),
        class: tool,
      };
    } else
      result[entry.name] =
        typeof entry.registration === 'function'
          ? entry.registration
          : copySettings(entry.registration);
  }
  return result;
}
