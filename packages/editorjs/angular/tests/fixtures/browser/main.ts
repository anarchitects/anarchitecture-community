import '@angular/compiler';
import { createComponent } from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { EditorJs } from '@anarchitects/editorjs-angular';

const app = await createApplication();
const status = document.getElementById('status')!;
const editors = document.getElementById('editors')!;
let ready = 0;
let errors = 0;
let removed = 0;
function report() {
  status.textContent = `Ready: ${ready}; Errors: ${errors}; Removed: ${removed}`;
}

for (const [index, label] of ['First', 'Second'].entries()) {
  const host = document.createElement('aa-editorjs');
  editors.append(host);
  const component = createComponent(EditorJs, {
    hostElement: host,
    environmentInjector: app.injector,
  });
  component.setInput('data', {
    blocks: [{ type: 'paragraph', data: { text: `${label} editor content` } }],
  });
  component.setInput('config', { minHeight: 80 });
  component.instance.ready.subscribe(() => {
    ready++;
    report();
  });
  component.instance.error.subscribe((error) => {
    errors++;
    report();
    console.error(error);
  });
  app.attachView(component.hostView);
  const button = document.getElementById(
    index === 0 ? 'remove-first' : 'remove-second',
  ) as HTMLButtonElement;
  button.addEventListener('click', () => {
    app.detachView(component.hostView);
    component.destroy();
    host.remove();
    button.disabled = true;
    removed++;
    report();
  });
}
app.tick();
