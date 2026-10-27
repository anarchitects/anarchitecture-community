import { evaluated, probe } from '../probe';
evaluated('card');
export class Card {
  static get toolbox() {
    return { title: 'Registry card', icon: '<span>C</span>' };
  }
  static get isReadOnlySupported() {
    return true;
  }
  static get sanitize() {
    return { text: { mark: { 'data-registry-marker': true }, b: true } };
  }
  readonly element = document.createElement('div');
  constructor({
    data,
    config,
    readOnly,
  }: {
    data: { text?: string };
    config: { label: string };
    readOnly: boolean;
  }) {
    probe().blockCreated++;
    this.element.className = 'registry-card';
    this.element.dataset['label'] = config.label;
    this.element.contentEditable = String(!readOnly);
    this.element.innerHTML = data.text ?? '';
  }
  render() {
    return this.element;
  }
  save() {
    return { text: this.element.innerHTML };
  }
  destroy() {
    probe().blockDestroyed++;
  }
}
