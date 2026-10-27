import { evaluated } from '../probe';
evaluated('flag');
export class Flag {
  static get isTune() {
    return true;
  }
  readonly wrapper = document.createElement('div');
  #flagged: boolean;
  constructor({
    data,
    config,
  }: {
    data?: { flagged?: boolean };
    config: { label: string };
  }) {
    this.#flagged = data?.flagged ?? false;
    this.wrapper.dataset['tuneLabel'] = config.label;
    this.wrapper.dataset['flagged'] = String(this.#flagged);
  }
  wrap(block: HTMLElement) {
    this.wrapper.append(block);
    return this.wrapper;
  }
  render() {
    return {
      icon: '<span>F</span>',
      label: 'Registry flag',
      onActivate: () => {
        this.#flagged = !this.#flagged;
        this.wrapper.dataset['flagged'] = String(this.#flagged);
      },
    };
  }
  save() {
    return { flagged: this.#flagged };
  }
}
