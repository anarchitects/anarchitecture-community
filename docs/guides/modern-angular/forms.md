# Signal Forms and reusable controls

**S:** the 2024 book's signal and component chapters supply the reactive foundation; it does not specify Angular Signal Forms. **V:** `form`, `FormField`, `FormRoot` and `FormValueControl` are stable in Angular 22. **A:** A07 adopts Signal Forms as the default for new Angular 22+ forms, subject to the local ADR/release gate.

## Model, field tree and state

Own the form's value in a writable signal and create a form tree with `form`. Bind a field tree through `[formField]`; call the field to inspect its state, such as touched, invalid or errors. Do not maintain a second independently writable copy of the same values in a legacy `FormGroup`. Keep transport DTO mapping and server validation separate from presentation state.

Define validation in the schema and present errors at an appropriate interaction point. A required flag does not replace an accessible label or an error message. Keep stable identifiers for dynamic rows; define how adding/removing rows affects values, dirty state and focus. Conditional fields need explicit hidden/disabled semantics: a field being invisible is not proof its value should be submitted. Async validation must handle pending state, cancellation and network failure. The server remains authoritative for permissions and domain invariants.

## Original complete control and form example

This small form demonstrates a value control, native Signal Forms binding and validation. Submission saves only a local confirmation; replace that action with an awaited application use case in production. A POST method prevents a pre-hydration fallback from placing values in a GET query string; the host must still define its native POST behavior.

<!-- example-file: editorial-form.ts -->

```ts
import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  FormValueControl,
  required,
} from '@angular/forms/signals';

@Component({
  selector: 'editorial-title-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label
      >Review title
      <input
        [value]="value()"
        [disabled]="disabled()"
        [attr.aria-invalid]="invalid() || null"
        (input)="update($event)"
        (blur)="touch.emit()"
      />
    </label>
  `,
})
export class ReviewTitleControl implements FormValueControl<string> {
  readonly value = model('');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly touch = output<void>();

  update(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}

@Component({
  selector: 'editorial-review-form',
  imports: [FormField, FormRoot, ReviewTitleControl],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form method="post" [formRoot]="fields">
      <editorial-title-control [formField]="fields.title" />
      @if (fields.title().touched() && fields.title().invalid()) {
        <p role="alert">Enter a review title.</p>
      }
      <button
        type="submit"
        [disabled]="fields().invalid() || fields().submitting()"
      >
        Save locally
      </button>
    </form>
    <p aria-live="polite">{{ saved() }}</p>
  `,
})
export class ReviewForm {
  readonly value = signal({ title: '' });
  readonly saved = signal('');
  readonly fields = form(this.value, (path) => required(path.title), {
    submission: {
      ignoreValidators: 'none',
      action: async (field) => {
        this.saved.set(field().value().title);
        return undefined;
      },
    },
  });
}
```

`FormValueControl<T>` requires a `ModelSignal<T>` value. Checkbox-style controls instead use the checked-control contract; do not implement both value and checked semantics accidentally. Implement the optional state inputs and focus/reset behavior that a real composite control needs. A control with readonly, disabled, invalid or pending appearance must carry that state through to its interactive elements and accessibility attributes. The optional touch output reports interaction; it does not replace domain events.

Use native Angular compatibility support at a deliberate migration seam. Do not implement `ControlValueAccessor` and `FormValueControl` on the same control, and do not invent a second Forms facade to simulate compatibility. Check availability of `compatForm` and `SignalFormControl` against the actual installed version before adopting that newer bridge. Existing CVA-based public contracts can remain in a supported legacy release until an explicit migration changes them.

## Submission, reset and server rendering

For a real HTML form, use the supported `[formRoot]`/submission API or an explicit submit handler that prevents native navigation and awaits the operation. In current Angular 22, `FormRoot` suppresses native default submission and integrates configured form submission; `submit` provides form-aware validation and submitting state. Report server errors through the supported field/form mechanism and retain values on failure. Prevent duplicate requests and show pending state. Current submission options default to ignoring pending validators; choose `ignoreValidators: 'none'` when submission must wait for validation to pass, as this example does. Do not clear a form until success is confirmed.

Reset through the form tree's reset API with the intended value so interaction flags and values agree; setting only the model is not equivalent to resetting touched/dirty state. Test reset and any custom reset/focus implementation. A production control needs labelled errors, keyboard operation, focus management and stable IDs across SSR/hydration.

Before hydration, Angular event handlers and directives may not yet be attached. HTML must be safe on its own: sensitive values must never fall back to a GET query string. Choose a safe native method/action, a non-submitting button where submission is intentionally unavailable, or a host strategy that blocks unsafe fallback. Test both click and Enter with JavaScript delayed or unavailable. Event replay is not a privacy boundary.

## Adoption gate

Do not change the Angular 21 package line to depend on Angular 22 Forms APIs. Release the supported legacy line first where required, then update peers, packaged declarations, consumer examples and migration notes together. In DDD, the accepted amendment replaces the earlier Signal Forms exclusion for new work on an approved Angular 22+ runtime. In 3-Tier, retain the foundation/forms/auth release ordering and existing package-removal conditions.
