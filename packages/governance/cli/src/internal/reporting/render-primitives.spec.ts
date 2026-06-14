import {
  escapeMarkdownCell,
  renderJsonValue,
  renderMarkdownTable,
  renderTextTable,
  renderTwoColumnTextTable,
} from './render-primitives.js';

describe('shared reporting primitives', () => {
  it('escapes markdown table cell separators', () => {
    expect(escapeMarkdownCell('a|b|c')).toBe('a\\|b\\|c');
  });

  it('renders a simple two-column text table', () => {
    const lines = renderTwoColumnTextTable({
      headers: ['Field', 'Value'],
      rows: [
        ['alpha', '1'],
        ['beta', '22'],
      ],
    });

    expect(lines).toEqual([
      'Field  Value',
      '-----  -----',
      'alpha  1    ',
      'beta   22   ',
    ]);
  });

  it('renders multi-column text tables deterministically', () => {
    const lines = renderTextTable({
      headers: ['id', 'kind', 'name'],
      rows: [
        ['node-a', 'project', 'alpha'],
        ['node-b', 'resource', 'beta'],
      ],
    });

    expect(lines).toEqual([
      'id      kind      name ',
      '------  --------  -----',
      'node-a  project   alpha',
      'node-b  resource  beta ',
    ]);
  });

  it('renders markdown tables using escaped cells', () => {
    const lines = renderMarkdownTable({
      headers: ['Field', 'Value'],
      rows: [['scope', 'customer|order']],
    });

    expect(lines).toEqual([
      '| Field | Value |',
      '| --- | --- |',
      '| scope | customer\\|order |',
    ]);
  });

  it('supports deterministic stable JSON serialization', () => {
    const rendered = renderJsonValue(
      {
        z: { b: 2, a: 1 },
        a: 0,
      },
      { stable: true },
    );

    expect(rendered).toBe(
      [
        '{',
        '  "a": 0,',
        '  "z": {',
        '    "a": 1,',
        '    "b": 2',
        '  }',
        '}',
      ].join('\n'),
    );
  });
});
