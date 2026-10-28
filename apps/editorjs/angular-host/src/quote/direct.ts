import {
  composeToolRegistry,
  createToolMap,
  createToolResolver,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
  validateOutputData,
} from '@anarchitects/editorjs-core';
import {
  defineQuoteTool,
  validateQuoteData,
} from '@anarchitects/editorjs-tool-quote';
import { quoteDefinition } from './definition';

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing fixture element: ${selector}`);
  return element;
}
const holder = required<HTMLElement>('#editor');
const output = required<HTMLOutputElement>('output');
const registry = composeToolRegistry([[quoteDefinition]], {
  profile: EDITOR_JS_2_31_7_TOOL_PROFILE,
});
const resolver = createToolResolver(registry, { defaultBlock: 'quote' });
required<HTMLButtonElement>('#mount').onclick = async (event) => {
  (event.currentTarget as HTMLButtonElement).disabled = true;
  try {
    const { default: EditorJS } = await import('@editorjs/editorjs');
    const editor = new EditorJS({
      holder,
      tools: await resolver.resolve(),
      defaultBlock: 'quote',
      minHeight: 50,
    });
    await editor.isReady;
    const { ObservedQuote: QuoteTool } = await import('./observed');
    const secondDefinition = defineQuoteTool({
      name: 'citation',
      source: 'eager',
      registration: {
        class: QuoteTool,
        config: {
          quotePlaceholder: '',
          captionPlaceholder: '',
          defaultAlignment: 'left',
        },
      },
    });
    const secondTools = createToolMap(
      composeToolRegistry([[secondDefinition]], {
        profile: EDITOR_JS_2_31_7_TOOL_PROFILE,
      }),
      { defaultBlock: 'citation' },
    );
    const single = new EditorJS({
      holder: 'second',
      tools: secondTools,
      defaultBlock: 'citation',
      minHeight: 50,
    });
    const defaults = new EditorJS({
      holder: 'defaults',
      tools: { quote: QuoteTool },
      defaultBlock: 'quote',
      minHeight: 50,
    });
    await Promise.all([single.isReady, defaults.isReady]);
    holder.dataset['ready'] = 'true';
    let last = await editor.save();
    const bind = (id: string, action: () => Promise<unknown> | void) => {
      required<HTMLButtonElement>(`#${id}`).onclick = () => {
        holder.dataset['command'] = `${id}:pending`;
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
        toolValidators: new Map([['quote', validateQuoteData]]),
        unknownTools: 'reject',
      });
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      output.textContent = JSON.stringify(last);
    });
    bind('render', () => editor.render(last));
    bind('clear', () => editor.clear());
    bind('readonly', () => editor.readOnly.toggle());
    bind('save-second', async () => {
      required('#second-output').textContent = JSON.stringify(
        await single.save(),
      );
    });
    bind('save-defaults', async () => {
      required('#defaults-output').textContent = JSON.stringify(
        await defaults.save(),
      );
    });
    bind('remove-main', () => {
      resolver.dispose();
      editor.destroy();
    });
    bind('remove', () => {
      resolver.dispose();
      if (holder.childElementCount) editor.destroy();
      single.destroy();
      defaults.destroy();
    });
  } catch (error) {
    output.textContent = String(error);
  }
};
