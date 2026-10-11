import { describe, expect, expectTypeOf, it } from 'vitest';
import { parseContentWithProvenance, parseOutputData } from '../src/index.js';
import type {
  ContentParseResult,
  ContentProvenance,
  OutputData,
} from '../src/index.js';

const legacyDocument = {
  version: '2.20.0',
  time: 1_700_000_000_000,
  blocks: [
    { type: 'paragraph', data: { text: 'An existing document.' } },
    { type: 'header', data: { text: 'A heading', level: 2 } },
    { type: 'vendor/custom', data: { nested: [null, true, { value: 3 }] } },
  ],
};

describe('optional content provenance', () => {
  it('round-trips legacy raw OutputData without introducing a storage envelope', () => {
    const serialized = JSON.stringify(legacyDocument);
    const result = parseContentWithProvenance(serialized);
    expect(result).toEqual({ ok: true, data: legacyDocument });
    if (!result.ok) return;
    expect(Object.hasOwn(result, 'provenance')).toBe(false);
    expect(JSON.stringify(result.data)).toBe(serialized);
    expect(parseOutputData(result.data)).toEqual({
      ok: true,
      data: legacyDocument,
    });
    expectTypeOf(result.data).toEqualTypeOf<OutputData>();
  });

  it('keeps editor, application schema, producer, and tool versions distinct', () => {
    const provenance: ContentProvenance = {
      schema: { id: 'example/article', version: '5' },
      producer: { name: 'example-host', version: '3.4.0' },
      toolVersions: {
        paragraph: '2.11.6',
        header: '2.8.8',
        'vendor/custom': '1.0.0',
      },
    };
    const result = parseContentWithProvenance(legacyDocument, provenance);
    expect(result).toEqual({ ok: true, data: legacyDocument, provenance });
    if (!result.ok) return;
    expect(result.data).not.toBe(legacyDocument);
    expect(result.provenance).not.toBe(provenance);
    expect(result.provenance?.toolVersions).not.toBe(provenance.toolVersions);
    expect(result.data.version).toBe('2.20.0');
  });

  it('preserves unknown/future versions without automatic upgrade or downgrade', () => {
    const data = { ...legacyDocument, version: '99.0.0-next.1' };
    const provenance = {
      schema: { id: 'unknown/schema', version: 'future-release' },
      toolVersions: { 'unknown/tool': '2099.0', header: 'legacy-build' },
      producer: { name: 'future-host', version: 'next' },
      extension: { metadataVersion: 27 },
    };
    const result = parseContentWithProvenance(data, provenance);
    expect(result).toEqual({ ok: true, data, provenance });
    if (!result.ok) return;
    expect(
      parseContentWithProvenance(
        JSON.stringify(result.data),
        result.provenance,
      ),
    ).toEqual(result);
    expect(
      parseContentWithProvenance(data, {
        ...provenance,
        schema: { id: 'unknown/schema', version: '1' },
      }),
    ).toMatchObject({ ok: true, data });
    expect(data.version).toBe('99.0.0-next.1');
    expect(provenance.schema.version).toBe('future-release');
  });

  it('does not infer missing versions or interpret extensions inside raw documents as provenance', () => {
    const data = {
      blocks: [],
      schema: { id: 'custom', version: '7' },
      toolVersions: { custom: '9' },
    };
    expect(parseContentWithProvenance(data)).toEqual({ ok: true, data });
    const metadata = { producer: { name: 'host' } };
    expect(parseContentWithProvenance({ blocks: [] }, metadata)).toEqual({
      ok: true,
      data: { blocks: [] },
      provenance: metadata,
    });
    expect(parseContentWithProvenance({ blocks: [] }, {})).toEqual({
      ok: true,
      data: { blocks: [] },
      provenance: {},
    });
  });

  it('preserves future metadata fields and prototype-like tool names as data', () => {
    const provenance = JSON.parse(
      '{"toolVersions":{"__proto__":"7","constructor":"8"},"schema":{"id":"generic","version":"1","extension":true},"__proto__":{"marker":true}}',
    );
    const result = parseContentWithProvenance({ blocks: [] }, provenance);
    expect(result).toEqual({ ok: true, data: { blocks: [] }, provenance });
    if (!result.ok || !result.provenance) return;
    expect(Object.getPrototypeOf(result.provenance)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(result.provenance.toolVersions)).toBe(
      Object.prototype,
    );
    expect(Object.hasOwn(result.provenance, '__proto__')).toBe(true);
    expect(Object.hasOwn(Object.prototype, 'marker')).toBe(false);
  });

  it.each([
    [null, 'invalid_type', ['provenance']],
    [[], 'invalid_type', ['provenance']],
    ['metadata', 'invalid_type', ['provenance']],
    [{ schema: {} }, 'missing_property', ['provenance', 'schema', 'id']],
    [
      { schema: { id: 'example' } },
      'missing_property',
      ['provenance', 'schema', 'version'],
    ],
    [
      { schema: { id: 'example', version: 1 } },
      'invalid_type',
      ['provenance', 'schema', 'version'],
    ],
    [
      { schema: { id: ' ', version: '1' } },
      'invalid_type',
      ['provenance', 'schema', 'id'],
    ],
    [{ toolVersions: [] }, 'invalid_type', ['provenance', 'toolVersions']],
    [
      { toolVersions: { header: '' } },
      'invalid_type',
      ['provenance', 'toolVersions', 'header'],
    ],
    [
      { toolVersions: { '': '1' } },
      'invalid_type',
      ['provenance', 'toolVersions', ''],
    ],
    [
      { producer: { version: '1' } },
      'missing_property',
      ['provenance', 'producer', 'name'],
    ],
    [
      { producer: { name: 'host', version: null } },
      'invalid_type',
      ['provenance', 'producer', 'version'],
    ],
    [{ schema: undefined }, 'non_json_value', ['provenance', 'schema']],
  ])(
    'reports invalid sidecar fields without returning partial content: %j',
    (provenance, code, path) => {
      const result = parseContentWithProvenance(legacyDocument, provenance);
      expect(result).toMatchObject({ ok: false, error: { code, path } });
      expect(Object.hasOwn(result, 'data')).toBe(false);
    },
  );

  it('reports document failures separately and does not inspect metadata after a document failure', () => {
    let calls = 0;
    const provenance = {
      get schema() {
        calls++;
        return {};
      },
    };
    expect(parseContentWithProvenance('{', provenance)).toMatchObject({
      ok: false,
      error: { code: 'invalid_json', path: ['data'] },
    });
    expect(parseContentWithProvenance({}, provenance)).toMatchObject({
      ok: false,
      error: { code: 'missing_property', path: ['data', 'blocks'] },
    });
    expect(
      parseContentWithProvenance(legacyDocument, provenance),
    ).toMatchObject({
      ok: false,
      error: { code: 'non_json_value', path: ['provenance', 'schema'] },
    });
    expect(calls).toBe(0);
  });

  it('reuses JSON protections for cyclic, executable, and unreadable metadata', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(parseContentWithProvenance(legacyDocument, cyclic)).toMatchObject({
      ok: false,
      error: { code: 'circular_reference', path: ['provenance', 'self'] },
    });
    expect(
      parseContentWithProvenance(legacyDocument, { transform: () => ({}) }),
    ).toMatchObject({
      ok: false,
      error: { code: 'non_json_value', path: ['provenance', 'transform'] },
    });
    const proxy = Proxy.revocable({}, {});
    proxy.revoke();
    expect(
      parseContentWithProvenance(legacyDocument, proxy.proxy),
    ).toMatchObject({
      ok: false,
      error: { code: 'unreadable_value', path: ['provenance'] },
    });
    expectTypeOf<
      Extract<ContentParseResult, { ok: true }>['provenance']
    >().toEqualTypeOf<ContentProvenance | undefined>();
  });
});
