# Original example verification suite

This suite is extracted by the [validation recipe](validation.md) into a disposable Angular CLI workspace. It tests the guide’s original units and is not part of any published library.

<!-- example-file: guide.spec.ts -->

```ts
import { TestBed } from '@angular/core/testing';
import {
  createEnvironmentInjector,
  EnvironmentInjector,
  inject,
  Injectable,
} from '@angular/core';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
  withRequestsMadeViaParent,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { provideReviewPolicy, REVIEW_POLICY } from './editorial-policy';
import {
  provideEditorial,
  provideReviewChannel,
  provideTitleSuffix,
  ReviewRegistry,
  REVIEW_SINK,
  TITLE_DECORATOR,
  withReviewSink,
} from './editorial-providers';
import { ReviewState } from './editorial-state';
import { ReviewForm } from './editorial-form';
import { describe, it, expect, afterEach } from 'vitest';

@Injectable({ providedIn: 'root' })
class RootReader {
  readonly client = inject(HttpClient);
}

afterEach(() => TestBed.resetTestingModule());

describe('documented provider composition', () => {
  it('supplies a callable policy without constructing it as a class', () => {
    TestBed.configureTestingModule({
      providers: [provideReviewPolicy((title) => title.trim().length >= 3)],
    });
    expect(TestBed.inject(REVIEW_POLICY)('ab')).toBe(false);
    expect(TestBed.inject(REVIEW_POLICY)('review')).toBe(true);
  });
  it('selects the supplied feature and rejects duplicate modes', () => {
    const messages: string[] = [];
    TestBed.configureTestingModule({
      providers: [
        provideEditorial(withReviewSink((message) => messages.push(message))),
      ],
    });
    TestBed.inject(REVIEW_SINK)('ready');
    expect(messages).toEqual(['ready']);
    expect(() =>
      provideEditorial(
        withReviewSink(() => {}),
        withReviewSink(() => {}),
      ),
    ).toThrow();
  });
  it('unregisters only the destroyed child channel', () => {
    TestBed.configureTestingModule({ providers: [provideEditorial()] });
    const parent = TestBed.inject(EnvironmentInjector);
    const a = createEnvironmentInjector([provideReviewChannel()], parent);
    const b = createEnvironmentInjector([provideReviewChannel()], parent);
    const registry = TestBed.inject(ReviewRegistry);
    expect(registry.size).toBe(2);
    a.destroy();
    expect(registry.size).toBe(1);
    b.destroy();
    expect(registry.size).toBe(0);
  });
  it('delegates through two decorator environments exactly once', () => {
    TestBed.configureTestingModule({ providers: [provideEditorial()] });
    const a = createEnvironmentInjector(
      [provideTitleSuffix(' / first')],
      TestBed.inject(EnvironmentInjector),
    );
    const b = createEnvironmentInjector([provideTitleSuffix(' / second')], a);
    expect(b.get(TITLE_DECORATOR)('Title')).toBe('Title / first / second');
    b.destroy();
    a.destroy();
  });
  it('defines a fallback when the decorator has no parent provider', () => {
    const child = createEnvironmentInjector(
      [provideTitleSuffix('!')],
      TestBed.inject(EnvironmentInjector),
    );
    expect(child.get(TITLE_DECORATOR)('Ready')).toBe('Ready!');
    child.destroy();
  });
});

describe('documented state and forms', () => {
  it('derives counts with immutable updates and isolates state instances', () => {
    const one = new ReviewState();
    const two = new ReviewState();
    const input = [
      { id: 'a', approved: false },
      { id: 'b', approved: false },
    ];
    one.replace(input);
    const before = one.items();
    input[0].approved = true;
    expect(one.outstanding()).toBe(2);
    one.approve('a');
    expect(one.outstanding()).toBe(1);
    expect(before[0].approved).toBe(false);
    expect(two.items()).toEqual([]);
  });
  it('binds native input, touch, validation and reset through a custom value control', async () => {
    const fixture = TestBed.createComponent(ReviewForm);
    await fixture.whenStable();
    const instance = fixture.componentInstance;
    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input');
    expect(instance.fields().invalid()).toBe(true);
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(instance.fields.title().touched()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role=alert]')).not.toBeNull();
    input.value = 'Review courtyard';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(instance.value().title).toBe('Review courtyard');
    expect(instance.fields().invalid()).toBe(false);
    expect(instance.fields.title().dirty()).toBe(true);
    instance.fields().reset({ title: '' });
    await fixture.whenStable();
    expect(input.value).toBe('');
    expect(instance.fields.title().dirty()).toBe(false);
    expect(instance.fields.title().touched()).toBe(false);
  });
  it('prevents attached native submission and invokes the configured action', async () => {
    const fixture = TestBed.createComponent(ReviewForm);
    fixture.componentInstance.value.set({ title: 'Review arcade' });
    await fixture.whenStable();
    const event = new Event('submit', { bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('form').dispatchEvent(event);
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.saved()).toBe('Review arcade');
    expect(fixture.nativeElement.querySelector('form').method).toBe('post');
  });
  it('rejects duplicate async submissions and preserves values on server validation failure', async () => {
    const fixture = TestBed.createComponent(ReviewForm);
    const form = fixture.componentInstance.fields;
    fixture.componentInstance.value.set({ title: 'Occupied title' });
    await fixture.whenStable();
    let finish!: () => void;
    let calls = 0;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const first = submit(form, async () => {
      calls++;
      await pending;
      return [
        {
          fieldTree: form.title,
          kind: 'server',
          message: 'Choose another title.',
        },
      ];
    });
    const second = await submit(form, async () => {
      calls++;
      return undefined;
    });
    expect(second).toBe(false);
    expect(form().submitting()).toBe(true);
    finish();
    expect(await first).toBe(false);
    expect(calls).toBe(1);
    expect(
      form
        .title()
        .errors()
        .some((error) => error.kind === 'server'),
    ).toBe(true);
    expect(fixture.componentInstance.value().title).toBe('Occupied title');
  });
});

describe('HTTP environment ownership', () => {
  it('runs child then parent interceptors without changing a root service client', async () => {
    const order: string[] = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([
            (request, next) => {
              order.push('parent');
              return next(request);
            },
          ]),
        ),
        provideHttpClientTesting(),
      ],
    });
    const rootReader = TestBed.inject(RootReader);
    const child = createEnvironmentInjector(
      [
        provideHttpClient(
          withInterceptors([
            (request, next) => {
              order.push('child');
              return next(request);
            },
          ]),
          withRequestsMadeViaParent(),
        ),
      ],
      TestBed.inject(EnvironmentInjector),
    );
    const requests = TestBed.inject(HttpTestingController);
    const childResponse = firstValueFrom(child.get(HttpClient).get('/reviews'));
    requests.expectOne('/reviews').flush([]);
    await childResponse;
    expect(order).toEqual(['child', 'parent']);
    order.length = 0;
    expect(child.get(RootReader)).toBe(rootReader);
    const rootResponse = firstValueFrom(
      child.get(RootReader).client.get('/root-reviews'),
    );
    requests.expectOne('/root-reviews').flush([]);
    await rootResponse;
    expect(order).toEqual(['parent']);
    requests.verify();
    child.destroy();
  });
});
```
