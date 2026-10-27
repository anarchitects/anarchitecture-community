import { defineHeaderTool } from '@anarchitects/editorjs-tool-header';

/** One inert definition shared by direct and Angular packed consumers. */
export const headerDefinition = defineHeaderTool({
  source: 'lazy',
  load: () => import('./observed').then(({ ObservedHeader }) => ObservedHeader),
  settings: {
    config: { placeholder: 'Section title', levels: [3, 2], defaultLevel: 2 },
    inlineToolbar: ['bold', 'italic', 'link'],
    toolbox: { title: 'Section heading' },
  },
});
