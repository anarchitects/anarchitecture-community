import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'aa-root',
  imports: [RouterLink, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Fixture routes">
      <a routerLink="/">Public</a>
      <a routerLink="/standalone">Standalone</a>
      <a routerLink="/forms">Signal Forms</a>
    </nav>
    <main><router-outlet /></main>
  `,
})
export class App {}
