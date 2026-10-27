import {
  composeToolRegistry,
  createToolMap,
  createToolResolver,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
  validateOutputData,
} from '@anarchitects/editorjs-core';
import {
  defineHeaderTool,
  validateHeaderData,
} from '@anarchitects/editorjs-tool-header';
import { headerDefinition } from './definition';

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing fixture element: ${selector}`);
  return element;
}
const holder = required<HTMLElement>('#editor');
const output = required<HTMLOutputElement>('output');
const registry = composeToolRegistry([[headerDefinition]], {
  profile: EDITOR_JS_2_31_7_TOOL_PROFILE,
});
const resolver = createToolResolver(registry, { defaultBlock: 'header' });
required<HTMLButtonElement>('#mount').onclick = async (event) => {
  (event.currentTarget as HTMLButtonElement).disabled = true;
  try {
    const { default: EditorJS } = await import('@editorjs/editorjs');
    const editor = new EditorJS({
      holder,
      tools: await resolver.resolve(),
      defaultBlock: 'header',
      minHeight: 50,
    });
    await editor.isReady;
    const { ObservedHeader: HeaderTool } = await import('./observed');
    const singleton = defineHeaderTool({
      name: 'title',
      source: 'eager',
      registration: {
        class: HeaderTool,
        config: { levels: [4], defaultLevel: 4 },
      },
    });
    const singletonRegistry = composeToolRegistry([[singleton]], {
      profile: EDITOR_JS_2_31_7_TOOL_PROFILE,
    });
    const singletonTools = createToolMap(singletonRegistry, {
      defaultBlock: 'title',
    });
    const single = new EditorJS({
      holder: 'singleton',
      tools: singletonTools,
      defaultBlock: 'title',
      minHeight: 50,
    });
    const defaults = new EditorJS({
      holder: 'defaults',
      tools: { header: HeaderTool },
      defaultBlock: 'header',
      minHeight: 50,
    });
    await Promise.all([single.isReady, defaults.isReady]);
    holder.dataset['ready'] = 'true';
    let last = await editor.save();
    const bind = (id: string, action: () => Promise<unknown> | void) => {
      required<HTMLButtonElement>(`#${id}`).onclick = () => {
        Promise.resolve()
          .then(action)
          .then(() => {
            holder.dataset['command'] = id;
          })
          .catch((error) => {
            output.textContent = String(error);
          });
      };
    };
    bind('save', async () => {
      last = await editor.save();
      const result = validateOutputData(last, {
        toolValidators: new Map([['header', validateHeaderData]]),
        unknownTools: 'reject',
      });
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      output.textContent = JSON.stringify(last);
    });
    bind('render', () => editor.render(last));
    bind('clear', () => editor.clear());
    bind('readonly', () => editor.readOnly.toggle());
    bind('save-singleton', async () => {
      required('#singleton-output').textContent = JSON.stringify(
        await single.save(),
      );
    });
    bind('remove', () => {
      resolver.dispose();
      editor.destroy();
      single.destroy();
      defaults.destroy();
    });
  } catch (error) {
    output.textContent = String(error);
  }
};
