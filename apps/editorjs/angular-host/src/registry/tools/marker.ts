import { evaluated } from '../probe';
evaluated('marker');
export class Marker {
  static get isInline() {
    return true;
  }
  static get sanitize() {
    return { mark: { 'data-registry-marker': true } };
  }
  render() {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Mark';
    button.setAttribute('aria-label', 'Registry mark');
    return button;
  }
  surround(range: Range) {
    const mark = document.createElement('mark');
    mark.dataset['registryMarker'] = 'true';
    mark.append(range.extractContents());
    range.insertNode(mark);
  }
  checkState() {
    return false;
  }
}
