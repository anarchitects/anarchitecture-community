import { defineQuoteTool } from '@anarchitects/editorjs-tool-quote';
/** Same inert definition in independent direct and Angular hosts. */
export const quoteDefinition = defineQuoteTool({
  source: 'lazy',
  load: () => import('./observed').then(({ ObservedQuote }) => ObservedQuote),
  settings: {
    config: {
      quotePlaceholder: 'Quotation',
      captionPlaceholder: 'Attribution',
      defaultAlignment: 'center',
    },
    inlineToolbar: ['bold', 'italic', 'link'],
    toolbox: { title: 'Citation' },
  },
});
