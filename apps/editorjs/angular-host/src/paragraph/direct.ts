import {
  composeToolRegistry,
  createToolResolver,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
  validateOutputData,
} from '@anarchitects/editorjs-core';
import { validateParagraphData } from '@anarchitects/editorjs-tool-paragraph';
import { paragraphDefinition } from './definition';

const holder = document.querySelector<HTMLElement>('#editor')!;
const output = document.querySelector('output')!;
const registry = composeToolRegistry([[paragraphDefinition]], {
  profile: EDITOR_JS_2_31_7_TOOL_PROFILE,
});
const resolver = createToolResolver(registry);
document.querySelector<HTMLButtonElement>('#mount')!.onclick = async (
  event,
) => {
  (event.currentTarget as HTMLButtonElement).disabled = true;
  try {
    const { default: EditorJS } = await import('@editorjs/editorjs');
    const editor = new EditorJS({
      holder,
      tools: await resolver.resolve(),
      minHeight: 50,
    });
    await editor.isReady;
    holder.dataset['ready'] = 'true';
    let last = await editor.save();
    const bind = (name: string, action: () => Promise<unknown> | void) => {
      document.querySelector<HTMLButtonElement>(`#${name}`)!.onclick = () => {
        Promise.resolve()
          .then(action)
          .then(() => {
            holder.dataset['command'] = name;
          })
          .catch((error) => {
            output.textContent = String(error);
          });
      };
    };
    bind('save', async () => {
      last = await editor.save();
      const result = validateOutputData(last, {
        toolValidators: new Map([['paragraph', validateParagraphData]]),
        unknownTools: 'reject',
      });
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      output.textContent = JSON.stringify(last);
    });
    bind('render', () => editor.render(last));
    bind('clear', () => editor.clear());
    bind('readonly', () => editor.readOnly.toggle());
    bind('remove', () => {
      resolver.dispose();
      editor.destroy();
    });
    const control = new EditorJS({ holder: 'builtin', minHeight: 50 });
    await control.isReady;
    document.querySelector<HTMLButtonElement>('#save-builtin')!.onclick =
      () => {
        control.save().then((data) => {
          document.querySelector('#builtin-output')!.textContent =
            JSON.stringify(data);
        });
      };
  } catch (error) {
    output.textContent = String(error);
  }
};
