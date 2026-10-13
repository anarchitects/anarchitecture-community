import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  signal,
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'aa-root',
  imports: [RouterLink, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Fixture routes">
      <a routerLink="/">Public</a>
      <a routerLink="/standalone">Standalone</a>
      <a routerLink="/deferred">Deferred</a>
      <a routerLink="/incremental">Incremental</a>
      <a routerLink="/forms">Signal Forms</a>
      <a routerLink="/forms-deferred">Deferred Forms</a>
      <a routerLink="/forms-incremental">Incremental Forms</a>
    </nav>
    <main [attr.data-rendered]="rendered()"><router-outlet /></main>
  `,
})
export class App {
  readonly rendered = signal(false);
  constructor() {
    afterNextRender(() => this.rendered.set(true));
  }
}
