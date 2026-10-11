/** Consumer-owned tool assumed by the README's typed custom-tool example. */
export class CalloutTool {
  constructor(
    readonly options: {
      data: { text: string; tone: 'info' | 'warning' };
      config?: { label: string };
    },
  ) {}

  render(): HTMLElement {
    const element = document.createElement('aside');
    element.textContent = this.options.data.text;
    return element;
  }

  save() {
    return this.options.data;
  }
}
