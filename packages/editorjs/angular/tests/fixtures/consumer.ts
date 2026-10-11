import { ChangeDetectionStrategy, Component } from '@angular/core';
import * as editorjsAngular from '@anarchitects/editorjs-angular';
import type { OutputData } from '@anarchitects/editorjs-core';

@Component({
  selector: 'aa-package-consumer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<p>{{ document.blocks.length }}</p>',
})
export class PackageConsumer {
  readonly document: OutputData = { blocks: [] };
  readonly packageExports = editorjsAngular;
}
