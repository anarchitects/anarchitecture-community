import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'aa-public-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1>Public page</h1>
    <p>This route has no authoring surface.</p>`,
})
export class PublicPage {}
