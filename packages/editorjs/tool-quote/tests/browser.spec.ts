import { expect, it } from 'vitest';
import type { BlockToolConstructable } from '@editorjs/editorjs';
import Quote from '@editorjs/quote';
import { QuoteTool } from '../src/browser.js';

it('exports the actual upstream constructor through the public Editor.js contract', () => {
  const constructor: BlockToolConstructable = QuoteTool;
  expect(constructor).toBe(Quote);
  expect(QuoteTool.isReadOnlySupported).toBe(true);
});

it('keeps the upstream private-enum alignment compatible with the pure public union', () => {
  const alignment: import('../src/index.js').QuoteAlignment =
    QuoteTool.DEFAULT_ALIGNMENT;
  expect(alignment).toBe('left');
  expect(QuoteTool.DEFAULT_QUOTE_PLACEHOLDER).toBe('Enter a quote');
  expect(QuoteTool.DEFAULT_CAPTION_PLACEHOLDER).toBe('Enter a caption');
});
