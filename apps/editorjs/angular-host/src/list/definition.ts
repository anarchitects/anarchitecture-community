import { defineListTool } from '@anarchitects/editorjs-tool-list';
/** Same inert definition in independent direct and Angular hosts. */
export const listDefinition = defineListTool({
  source: 'lazy',
  load: () => import('./observed').then(({ ObservedList }) => ObservedList),
  settings: {
    config: {
      defaultStyle: 'unordered',
      maxLevel: 2,
      counterTypes: ['numeric', 'upper-roman'],
    },
    inlineToolbar: ['bold', 'italic', 'link'],
  },
});
