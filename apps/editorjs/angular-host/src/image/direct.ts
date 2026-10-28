import {
  composeToolRegistry,
  createToolMap,
  createToolResolver,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
  validateOutputData,
} from '@anarchitects/editorjs-core';
import {
  defineImageTool,
  validateImageData,
} from '@anarchitects/editorjs-tool-image';
import type { PasteEvent } from '@editorjs/editorjs';
import {
  imageDefinition,
  imageData,
  releaseUploads,
  uploader,
  asset,
} from './definition';
function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}
const holder = required<HTMLElement>('#editor');
const output = required('output');
const resolver = createToolResolver(
  composeToolRegistry([[imageDefinition]], {
    profile: EDITOR_JS_2_31_7_TOOL_PROFILE,
  }),
);
required<HTMLButtonElement>('#mount').onclick = async (event) => {
  (event.currentTarget as HTMLButtonElement).disabled = true;
  try {
    const { default: EditorJS } = await import('@editorjs/editorjs');
    const editor = new EditorJS({
      holder,
      tools: await resolver.resolve(),
      data: { blocks: [{ type: 'image', data: imageData }] },
      minHeight: 50,
    });
    await editor.isReady;
    const { ObservedImage, pasteInto } = await import('./observed');
    const tools = createToolMap(
      composeToolRegistry(
        [
          [
            defineImageTool({
              name: 'photo',
              source: 'eager',
              registration: { class: ObservedImage, config: { uploader } },
            }),
          ],
        ],
        { profile: EDITOR_JS_2_31_7_TOOL_PROFILE },
      ),
    );
    const second = new EditorJS({
      holder: 'second',
      tools,
      data: { blocks: [{ type: 'photo', data: { ...imageData, alt: '' } }] },
      minHeight: 50,
    });
    await second.isReady;
    holder.dataset['ready'] = 'true';
    let last = await editor.save();
    let removed = false;
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
        toolValidators: new Map([['image', validateImageData]]),
      });
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      output.textContent = JSON.stringify(last);
    });
    bind('render', () => editor.render(last));
    bind('clear', () =>
      editor.render({ blocks: [{ type: 'image', data: {} }] }),
    );
    bind('readonly', () => editor.readOnly.toggle());
    bind('upload-url', () =>
      pasteInto(
        holder,
        new CustomEvent('pattern', {
          detail: { key: 'image', data: asset },
        }) as PasteEvent,
      ),
    );
    bind('release', releaseUploads);
    bind('save-second', async () => {
      required('#second-output').textContent = JSON.stringify(
        await second.save(),
      );
    });
    bind('remove-main', () => {
      resolver.dispose();
      editor.destroy();
      removed = true;
    });
    bind('remove', () => {
      resolver.dispose();
      if (!removed) editor.destroy();
      second.destroy();
    });
  } catch (error) {
    output.textContent = String(error);
  }
};
