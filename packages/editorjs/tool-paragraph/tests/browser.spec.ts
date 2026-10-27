import { expect, it } from 'vitest';
import type {
  BlockToolConstructable,
  BlockToolConstructorOptions,
} from '@editorjs/editorjs';
import Paragraph from '@editorjs/paragraph';
import { ParagraphTool } from '../src/browser.js';

it('bridges absent config through the public constructor without replacing upstream behavior', () => {
  const constructor: BlockToolConstructable = ParagraphTool;
  // Constructor-only fixture: render/save behavior is exercised in real browsers.
  const options = {
    data: { text: '' },
    readOnly: true,
    api: { styles: { block: 'block' } },
  } as BlockToolConstructorOptions;
  const instance = new constructor(options);
  expect(instance).toBeInstanceOf(Paragraph);
  expect(instance.render).toBe(Paragraph.prototype.render);
  expect(instance.save).toBe(Paragraph.prototype.save);
  expect(ParagraphTool.isReadOnlySupported).toBe(true);
});
