import { defineParagraphTool } from '@anarchitects/editorjs-tool-paragraph';

/** Same inert definition in portable and Angular consumers. */
export const paragraphDefinition = defineParagraphTool({
  source: 'lazy',
  replace: true,
  load: async () => (await import('./observed')).ObservedParagraph,
  settings: {
    config: { placeholder: 'Packaged paragraph', preserveBlank: true },
    inlineToolbar: ['bold', 'italic', 'link'],
  },
});
