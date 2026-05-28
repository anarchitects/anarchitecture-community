import {
  escapeMarkdownCell,
  renderJsonValue,
  renderMarkdownTable,
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
