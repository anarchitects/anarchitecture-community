import type { ToolDefinition, OutputData } from '@anarchitects/editorjs-core';
import { loading } from './probe';

/** Identical generic definitions consumed by Angular and the no-Angular host. */
export function definitions(label: string): readonly ToolDefinition[] {
  return [
    {
      name: 'card',
      kind: 'block',
      source: 'lazy',
      load: () => import('./tools/unselected').then((m) => m.Unselected),
    },
    {
      name: 'unused',
      kind: 'block',
      source: 'lazy',
      load: () => import('./tools/unselected').then((m) => m.Unselected),
    },
    {
      name: 'card',
      kind: 'block',
      source: 'lazy',
      replace: true,
      load: async () => {
        await loading('card');
        return (await import('./tools/card')).Card;
      },
      settings: {
        config: { label },
        inlineToolbar: ['marker', 'bold'],
        tunes: ['flag'],
      },
    },
    {
      name: 'marker',
      kind: 'inline',
      source: 'lazy',
      load: async () => {
        await loading('marker');
        return (await import('./tools/marker')).Marker;
      },
    },
    {
      name: 'flag',
      kind: 'tune',
      source: 'lazy',
      load: async () => {
        await loading('flag');
        return (await import('./tools/flag')).Flag;
      },
      settings: { config: { label } },
    },
  ];
}
export const selection = ['card', 'marker', 'flag'] as const;
export const editorOptions = {
  minHeight: 60,
  inlineToolbar: ['bold', 'italic', 'link'],
  tunes: ['moveUp', 'delete', 'moveDown'],
};
export const initialDocument = (label: string): OutputData => ({
  blocks: [
    { type: 'card', data: { text: `${label} custom` } },
    { type: 'paragraph', data: { text: `${label} paragraph` } },
  ],
});
