import { describe, expect, it } from 'vitest';
import { validateParagraphData } from '@anarchitects/editorjs-tool-paragraph';
import { validateHeaderData } from '@anarchitects/editorjs-tool-header';
import { validateQuoteData } from '@anarchitects/editorjs-tool-quote';
import { renderEditorJsHtml } from '../src/index.js';

describe('saved-profile conformance with neutral tool validators', () => {
  const profiles = [
    {
      type: 'paragraph',
      validate: validateParagraphData,
      values: [
        { text: '' },
        { text: 'Text', extension: { kept: true } },
        {},
        { text: 1 },
      ],
    },
    {
      type: 'header',
      validate: validateHeaderData,
      values: [
        ...Array.from({ length: 6 }, (_, index) => ({
          text: 'Title',
          level: index + 1,
        })),
        { text: 'Title', level: 0 },
        { text: 'Title', level: 7 },
        { text: 'Title', level: 1.5 },
        { text: 'Title' },
        { level: 2 },
      ],
    },
    {
      type: 'quote',
      validate: validateQuoteData,
      values: [
        { text: 'Quote', caption: 'Author', alignment: 'left' },
        { text: '', caption: '', alignment: 'center' },
        { text: 'Quote', caption: 'Author', alignment: 'right' },
        { text: 'Quote', alignment: 'left' },
        { text: 'Quote', caption: 1, alignment: 'left' },
        { caption: 'Author', alignment: 'left' },
      ],
    },
  ];
  for (const { type, validate, values } of profiles) {
    it.each(values)(`${type} agrees for %j`, (data) => {
      expect(
        renderEditorJsHtml({ blocks: [{ type, data }] }).status === 'success',
      ).toBe(validate(data).ok);
    });
  }
  it('keeps HTML safety stricter than structural tool validation', () => {
    const data = { text: '<script>alert(1)</script>' };
    expect(validateParagraphData(data).ok).toBe(true);
    expect(
      renderEditorJsHtml({ blocks: [{ type: 'paragraph', data }] }),
    ).toMatchObject({
      status: 'failure',
      diagnostics: [{ code: 'unsafe_html' }],
    });
  });
});
