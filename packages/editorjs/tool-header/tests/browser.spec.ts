import { expect, it } from 'vitest';
import type { BlockToolConstructable } from '@editorjs/editorjs';
import Header from '@editorjs/header';
import { HeaderTool } from '../src/browser.js';

it('exports the actual upstream constructor through the public Editor.js contract', () => {
  const constructor: BlockToolConstructable = HeaderTool;
  expect(constructor).toBe(Header);
  expect(HeaderTool.isReadOnlySupported).toBe(true);
});
