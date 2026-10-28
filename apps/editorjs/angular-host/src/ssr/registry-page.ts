import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { EDITOR_JS_TOOL_REGISTRY } from '@anarchitects/editorjs-angular';
import { RegistryEditor } from '../registry/editor';
import { probe } from '../registry/probe';
import { REGISTRY_FACTORY_LABEL, COMMON_TOOLS } from '../registry/context';
import { RequestState } from './request-state';

@Component({
  selector: 'aa-registry-page',
  imports: [RegistryEditor],
  providers: [RequestState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p data-testid="registry-config-label">{{ configLabel }}</p>
    <h1>Registry authoring</h1>
    <p data-testid="marker">{{ state.initial.marker }}</p>
    <p data-testid="registry-names">{{ registry.names.join(',') }}</p>
    <button type="button" (click)="mounted.set(!mounted())">
      Toggle registry A
    </button>
    <button type="button" (click)="fail()">Fail next tool</button>
    <button type="button" (click)="hold()">Hold next tool</button>
    @if (mounted()) {
      <aa-registry-editor
        data-registry-owner="A"
        [common]="common"
        [label]="state.initial.marker + '-A'"
      />
    }
    <aa-registry-editor
      data-registry-owner="B"
      [common]="common"
      [label]="state.initial.marker + '-B'"
    />
  `,
})
export class RegistryPage {
  readonly common = inject(COMMON_TOOLS);
  readonly registry = inject(EDITOR_JS_TOOL_REGISTRY);
  readonly configLabel = inject(REGISTRY_FACTORY_LABEL).value;
  readonly state = inject(RequestState);
  readonly mounted = signal(true);
  fail() {
    probe().failNext = true;
  }
  hold() {
    probe().holdNext = true;
  }
}
