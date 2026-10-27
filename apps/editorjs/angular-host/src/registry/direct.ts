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
import { probe } from './probe';

const registry = selectToolRegistry(
  composeToolRegistry([definitions('portable')], {
    profile: EDITOR_JS_2_31_7_TOOL_PROFILE,
  }),
  selection,
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
        data: initialDocument(label),
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
  required('button', section).addEventListener('click', async () => {
    const saved = await editor?.save();
    if (!disposed) required('pre', section).textContent = JSON.stringify(saved);
  });
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
