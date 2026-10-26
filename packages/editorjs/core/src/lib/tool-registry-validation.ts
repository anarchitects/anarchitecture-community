import {
  ToolRegistryError,
  type BuiltInToolProfile,
  type ToolDefinition,
  type ToolKind,
  type ToolRegistryErrorCode,
} from './tool-registry-contracts.js';

type Path = readonly (string | number)[];
type Code = ToolRegistryErrorCode;

export function fail(code: Code, path: Path, name?: string): never {
  throw new ToolRegistryError(code, path, name);
}

/** Read own data fields without invoking user accessors. Not a sandbox for Proxies. */
export function fields(
  value: unknown,
  allowed: readonly string[],
  code: Code,
  path: Path,
  name?: string,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(code, path, name);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype)
    fail(code, path, name);
  const result: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.includes(key))
      fail(code, path, name);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor))
      fail(code, [...path, key], name);
    result[key] = descriptor.value;
  }
  return result;
}

export function array(
  value: unknown,
  code: Code,
  path: Path,
  name?: string,
): unknown[] {
  if (!Array.isArray(value)) fail(code, path, name);
  const result: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor))
      fail(code, [...path, index], name);
    result.push(descriptor.value);
  }
  return result;
}

export function toolName(
  value: unknown,
  code: Code,
  path: Path,
  owner?: string,
): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    ['__proto__', 'prototype', 'constructor'].includes(value)
  )
    fail(code, path, owner);
  const index = Number(value);
  if (
    Number.isInteger(index) &&
    index >= 0 &&
    index < 2 ** 32 - 1 &&
    String(index) === value
  )
    fail(code, path, owner);
  return value;
}

function kind(value: unknown, code: Code, path: Path, name?: string): ToolKind {
  if (value !== 'block' && value !== 'inline' && value !== 'tune')
    fail(code, path, name);
  return value;
}

function opaqueObject(value: unknown, path: Path, name?: string): void {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  )
    fail('invalid-options', path, name);
}

function nameList(
  value: unknown,
  path: Path,
  name?: string,
): readonly string[] {
  return Object.freeze(
    array(value, 'invalid-options', path, name).map((item, index) =>
      toolName(item, 'invalid-options', [...path, index], name),
    ),
  );
}

function toolboxEntry(value: unknown, path: Path, name: string): object {
  const result = fields(
    value,
    ['title', 'icon', 'data'],
    'invalid-options',
    path,
    name,
  );
  for (const key of ['title', 'icon']) {
    if (result[key] !== undefined && typeof result[key] !== 'string')
      fail('invalid-options', [...path, key], name);
  }
  if (result['data'] !== undefined)
    opaqueObject(result['data'], [...path, 'data'], name);
  return Object.freeze(result);
}

export function settings(
  value: unknown,
  withClass: boolean,
  path: Path,
  name: string,
): Record<string, unknown> {
  const result = fields(
    value,
    withClass
      ? ['class', 'config', 'inlineToolbar', 'tunes', 'shortcut', 'toolbox']
      : ['config', 'inlineToolbar', 'tunes', 'shortcut', 'toolbox'],
    'invalid-options',
    path,
    name,
  );
  if (withClass && typeof result['class'] !== 'function')
    fail('invalid-definition', [...path, 'class'], name);
  if (result['config'] !== undefined)
    opaqueObject(result['config'], [...path, 'config'], name);
  for (const key of ['inlineToolbar', 'tunes']) {
    if (result[key] !== undefined && typeof result[key] !== 'boolean')
      result[key] = nameList(result[key], [...path, key], name);
  }
  if (
    result['shortcut'] !== undefined &&
    typeof result['shortcut'] !== 'string'
  )
    fail('invalid-options', [...path, 'shortcut'], name);
  const toolbox = result['toolbox'];
  if (toolbox !== undefined && toolbox !== false) {
    result['toolbox'] = Array.isArray(toolbox)
      ? Object.freeze(
          array(toolbox, 'invalid-options', [...path, 'toolbox'], name).map(
            (entry, index) =>
              toolboxEntry(entry, [...path, 'toolbox', index], name),
          ),
        )
      : toolboxEntry(toolbox, [...path, 'toolbox'], name);
  }
  return Object.freeze(result);
}

export function definition(value: unknown, path: Path): ToolDefinition {
  const data = fields(
    value,
    ['name', 'kind', 'source', 'replace', 'registration', 'load', 'settings'],
    'invalid-definition',
    path,
  );
  const name = toolName(data['name'], 'invalid-name', [...path, 'name']);
  const toolKind = kind(
    data['kind'],
    'invalid-definition',
    [...path, 'kind'],
    name,
  );
  if (data['replace'] !== undefined && data['replace'] !== true)
    fail('invalid-definition', [...path, 'replace'], name);
  if (data['source'] === 'eager') {
    if ('load' in data || 'settings' in data)
      fail('invalid-definition', path, name);
    const registration =
      typeof data['registration'] === 'function'
        ? data['registration']
        : settings(data['registration'], true, [...path, 'registration'], name);
    return Object.freeze({
      name,
      kind: toolKind,
      source: 'eager',
      ...(data['replace'] === true ? { replace: true } : {}),
      registration,
    }) as ToolDefinition;
  }
  if (data['source'] === 'lazy') {
    if ('registration' in data || typeof data['load'] !== 'function')
      fail('invalid-definition', path, name);
    return Object.freeze({
      name,
      kind: toolKind,
      source: 'lazy',
      ...(data['replace'] === true ? { replace: true } : {}),
      load: data['load'],
      ...(data['settings'] !== undefined
        ? {
            settings: settings(
              data['settings'],
              false,
              [...path, 'settings'],
              name,
            ),
          }
        : {}),
    }) as ToolDefinition;
  }
  return fail('invalid-definition', [...path, 'source'], name);
}

export function profile(value: unknown): BuiltInToolProfile {
  const data = fields(value, ['tools', 'defaultBlock'], 'invalid-profile', [
    'profile',
  ]);
  const names = new Set<string>();
  const tools = array(data['tools'], 'invalid-profile', [
    'profile',
    'tools',
  ]).map((value, index) => {
    const path = ['profile', 'tools', index];
    const entry = fields(
      value,
      ['name', 'kind', 'reserved'],
      'invalid-profile',
      path,
    );
    const name = toolName(entry['name'], 'invalid-profile', [...path, 'name']);
    if (names.has(name)) fail('invalid-profile', path, name);
    names.add(name);
    const toolKind = kind(
      entry['kind'],
      'invalid-profile',
      [...path, 'kind'],
      name,
    );
    if (entry['reserved'] !== undefined && entry['reserved'] !== true)
      fail('invalid-profile', [...path, 'reserved'], name);
    return Object.freeze({
      name,
      kind: toolKind,
      ...(entry['reserved'] === true ? { reserved: true as const } : {}),
    });
  });
  const defaultBlock =
    data['defaultBlock'] === undefined
      ? undefined
      : toolName(data['defaultBlock'], 'invalid-profile', [
          'profile',
          'defaultBlock',
        ]);
  if (
    defaultBlock !== undefined &&
    !tools.some(
      (tool) =>
        tool.name === defaultBlock && tool.kind === 'block' && !tool.reserved,
    )
  )
    fail('invalid-profile', ['profile', 'defaultBlock'], defaultBlock);
  return Object.freeze({
    tools: Object.freeze(tools),
    ...(defaultBlock === undefined ? {} : { defaultBlock }),
  });
}

/** Fresh upstream-facing shells; opaque objects are deliberately not cloned. */
export function copySettings(value: object): object {
  const copy = { ...value } as Record<string, unknown>;
  for (const key of ['inlineToolbar', 'tunes'])
    if (Array.isArray(copy[key])) copy[key] = [...copy[key]];
  if (Array.isArray(copy['toolbox']))
    copy['toolbox'] = copy['toolbox'].map((entry) => ({ ...entry }));
  else if (copy['toolbox'] && typeof copy['toolbox'] === 'object')
    copy['toolbox'] = { ...copy['toolbox'] };
  return copy;
}
