import {
  composeToolRegistry,
  createToolResolver,
  selectToolRegistry,
  EDITOR_JS_2_31_7_TOOL_PROFILE,
} from '@anarchitects/editorjs-core';
import type { EditorConfig } from '@editorjs/editorjs';
import {
  definitions,
  selection,
  initialDocument,
  editorOptions,
} from './definitions';
import * as common from '../common/definitions';
import type { OutputData } from '@anarchitects/editorjs-core';
import { probe } from './probe';

const commonTools = new URLSearchParams(location.search).has('common');
const onlyParagraph =
  new URLSearchParams(location.search).get('only') === 'paragraph';
const selected: readonly string[] = commonTools
  ? onlyParagraph
    ? ['paragraph']
    : common.selection
  : selection;
const registry = selectToolRegistry(
  composeToolRegistry(
    [commonTools ? common.definitions('portable') : definitions('portable')],
    {
      profile: EDITOR_JS_2_31_7_TOOL_PROFILE,
    },
  ),
  selected,
);
function required<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing fixture element: ${selector}`);
  return element;
}
function mount(label: string) {
  const section = document.createElement('section');
  section.dataset['registryOwner'] = label;
  section.innerHTML =
    '<div class="holder"></div><p data-testid="registry-ready">0</p><p data-testid="registry-error"></p><button type="button">Save registry</button><pre data-testid="registry-saved"></pre>';
  if (commonTools)
    section.insertAdjacentHTML(
      'beforeend',
      '<button data-command="render">Render saved</button><button data-command="readonly">Read only</button><div data-projection></div>',
    );
  document.body.append(section);
  const resolver = createToolResolver(registry, {
    inlineToolbar: editorOptions.inlineToolbar,
    tunes: editorOptions.tunes,
  });
  let disposed = false;
  let editor: import('@editorjs/editorjs').default | undefined;
  const initialize = async () => {
    try {
      const tools = await resolver.resolve();
      if (disposed) return;
      const { default: EditorJS } = await import('@editorjs/editorjs');
      if (disposed) return;
      editor = new EditorJS({
        ...editorOptions,
        holder: required('.holder', section),
        tools: tools as EditorConfig['tools'],
        data: commonTools
          ? {
              blocks: common
                .initialDocument(label)
                .blocks.filter((block) => selected.includes(block.type)),
            }
          : initialDocument(label),
      });
      probe().created++;
      await editor.isReady;
      if (disposed) {
        editor.destroy();
        probe().destroyed++;
        editor = undefined;
      } else
        required('[data-testid="registry-ready"]', section).textContent = '1';
    } catch (error) {
      if (!disposed)
        required('[data-testid="registry-error"]', section).textContent =
          `load:operation-failed:${String(error)}`;
    }
  };
  void initialize();
  let saved: OutputData | undefined;
  required('button', section).addEventListener('click', async () => {
    saved = await editor?.save();
    if (commonTools) common.validate(saved);
    if (commonTools && !disposed) {
      const projection = common.imageProjection(saved);
      const parent = required('[data-projection]', section);
      parent.replaceChildren();
      if (projection) {
        const image = document.createElement('img');
        image.dataset['testid'] = 'rendered-image';
        image.src = projection.url;
        if (projection.alt !== null) image.alt = projection.alt;
        parent.append(image);
      }
    }
    if (!disposed) required('pre', section).textContent = JSON.stringify(saved);
  });
  if (commonTools) {
    required('[data-command="render"]', section).addEventListener(
      'click',
      async () => {
        if (saved) await editor?.render(saved);
      },
    );
    required('[data-command="readonly"]', section).addEventListener(
      'click',
      async () => {
        await editor?.readOnly.toggle();
      },
    );
  }
  return () => {
    disposed = true;
    resolver.dispose();
    section.remove();
    if (
      editor &&
      section.querySelector('[data-testid="registry-ready"]')?.textContent ===
        '1'
    ) {
      editor.destroy();
      probe().destroyed++;
      editor = undefined;
    }
  };
}
let remove: (() => void) | undefined = mount('A');
mount('B');
required('#toggle').addEventListener('click', () => {
  if (remove) {
    remove();
    remove = undefined;
  } else remove = mount('A');
});
required('#fail').addEventListener('click', () => {
  probe().failNext = true;
});
required('#hold').addEventListener('click', () => {
  probe().holdNext = true;
});
