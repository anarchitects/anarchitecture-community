# Editor.js Signal Forms implementation contract

This contributor contract implements the planning slice #548 of epic #68. It defines
work for #549–#554. #549 implements the opt-in entry point and value binding;
#550 adds interaction state, availability, accessible presentation and focus. #551
adds reset invalidation, snapshots and validation/submission lifecycle contracts.
Remaining integration certification is planned in #552–#554. The
[package README](../packages/editorjs/angular/README.md) remains the authority for
currently available exports. The original #548 planning slice changed no runtime
code, dependencies or release versions. Implementation status and evidence live in the
[development guide](editorjs-angular-development.md).

## Decisions and evidence

All five repository ADRs were reviewed. Governance ADRs 0001–0003 retain their
Governance scope. The accepted [Modern Angular ADR](adr/modern-angular-22-signal-forms.md)
applies A01/A02/A05/A06/A07/A09/A10/A11: bounded Angular 22 support, deliberate
entry points, one state owner, native Signal Forms, browser-safe loading and
behavior/packaging evidence. [ADR 0004](adr/0004-public-package-documentation.md)
keeps implementation plans here and requires consumer documentation alongside each
shipped API change. There is no conflict with an accepted decision.

The architecture, reactivity, Forms, SSR/builds, testing and repository-application
guides informed this contract. The Angular MCP best-practices endpoint returned
`Unexpected response type`; official documentation and published versioned packages
provided the API evidence instead. The workspace currently uses Angular 22.1.4,
TypeScript 6.0.3 and Nx 23.2.1; the #548 inspection preceded installation of
`@angular/forms` in #549.

Published `@angular/forms` archives were inspected on 2026-10-11:

| Forms version | `FormValueControl`, `FormField`, `FormRoot` | `FormUiControl.focus/reset` | `compatForm`, `SignalFormControl` | Exact Angular core/common/platform-browser peers |
| ------------- | ------------------------------------------- | --------------------------- | --------------------------------- | ------------------------------------------------ |
| 22.0.0        | Present, public 22.0 APIs                   | Present                     | Present in `signals/compat`       | 22.0.0                                           |
| 22.1.4        | Present                                     | Present                     | Present in `signals/compat`       | 22.1.4                                           |
| 22.2.2        | Present                                     | Present                     | Present in `signals/compat`       | 22.2.2                                           |

The inspected declarations were `types/signals.d.ts`, `types/_structure-chunk.d.ts`
and `types/signals-compat.d.ts`. The published runtime was also inspected for the
custom-control binding, dirty propagation and reset order. This establishes API
availability, **not** compilation or browser certification of the planned adapter.
The packed-consumer matrix in #554 must supply that evidence on these baselines.

Official references:

- [FormValueControl](https://angular.dev/api/forms/signals/FormValueControl): a value model is required; checked-control semantics are separate.
- [FormUiControl](https://angular.dev/api/forms/signals/FormUiControl): optional state inputs, touch output and synchronous focus/reset hooks.
- [Custom controls](https://angular.dev/guide/forms/signals/custom-controls): native binding and interoperability contracts.
- [Migration](https://angular.dev/guide/forms/signals/migration), [compatForm](https://angular.dev/api/forms/signals/compat/compatForm) and [SignalFormControl](https://angular.dev/api/forms/signals/compat/SignalFormControl): Angular-owned migration seams.

## Package and ownership

Add `@anarchitects/editorjs-angular/forms` as an Angular Package Format secondary
entry point in the existing `editorjs-angular` Nx project. Export `EditorJsControl`
(selector `aa-editorjs-control`) and `EditorJsControlConfig` there. Do not re-export
them from the package root. A separate publishable package would introduce another
release/version boundary for a small adapter; adding Forms to the existing root
would weaken standalone use. The secondary entry point preserves that choice.

Declare `@angular/forms: ^22.0.0` as an optional peer through `peerDependenciesMeta`.
Forms consumers install it with matching Angular core/common/platform-browser
versions. Development and private browser hosts use the workspace's matching
version. Package-manager commands must establish actual links; no source-alias
workaround. Keep the existing bounded Angular/Editor.js/Node claims until the
expanded matrix validates any change. Node 27+ and Angular/Editor.js future majors
are not implied.

The root entry point must compile and import in an isolated consumer without Forms
installed. Neither its runtime graph nor its declaration graph may reference the
forms entry point. The forms entry point may import the root's public API, with no
reverse edge or private cross-entry-point import. This remains one Nx library with
its existing build/release targets. Core and standalone tools/upload packages gain
no Angular Forms dependency.

| Owner                                        | Responsibility                                                                                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consumer's form model and Angular field tree | Authoritative value; dirty/touched/validation/pending/submitting state; schema and submission policy.                                                                  |
| `EditorJsControl`                            | Native Forms contract; projection of field value/state into one child editor; composite interaction, accessibility, reset/focus adaptation and typed error forwarding. |
| Existing `EditorJs`                          | Browser loader, holder and raw instance; readiness/destruction; public editor operations.                                                                              |
| `EditorJsDocumentCoordinator` in core        | Normalization, snapshots, operation order, change coalescing, fingerprints and stale-work invalidation.                                                                |

Compose one `EditorJs` child. Do not instantiate a second coordinator or raw editor
in the Forms component. Small bookkeeping for the last published value, a pending
reset and the projected child input is adapter state, not another independently
editable form model. Any missing generic invalidation capability belongs in core
and reaches Forms through a supported Angular wrapper seam.

## Planned public control surface

| Surface                               | Contract                                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`                               | `model<OutputData>({ blocks: [] })`, implementing `FormValueControl<OutputData>`. No nullable/undefined document or `checked` member.                                                       |
| `config`                              | Initialization-only `EditorJsControlConfig`, derived from `EditorJsConfig` with `readOnly` omitted and forbidden (`readOnly?: never`). Forms owns availability.                             |
| Forms state inputs                    | `disabled`, `readonly`, `invalid`, `pending`, `touched`, `dirty`, `required` default false; `errors` uses Angular's public validation-error type and defaults empty; `name` defaults empty. |
| `touch`                               | Payload-free native Forms interaction output when focus leaves the complete control.                                                                                                        |
| `ready`, `change`, `error`            | Existing core payloads: void readiness, accepted saved document/sequence, typed operation/code/cause. Forward once; sequence remains editor-owner-local.                                    |
| `focus(options?: FocusOptions): void` | Angular Forms hook; route to the owned editor when usable. Handle its promise internally.                                                                                                   |
| `reset(): void`                       | Angular Forms hook for UI reconciliation and invalidation, not an independent form-tree reset API.                                                                                          |
| `save(): Promise<OutputData>`         | Read a current snapshot through the child's existing API; no value/change emission caused solely by this call. Same readiness/read-only/disposal limits and typed rejection contract.       |

Bind through `[formField]`. Do not combine that binding with competing `[value]` or
`[(value)]` bindings. `[(value)]` alone remains a native component-model use case,
without Angular field state. Do not add a second `data` input or a public mutable
child reference. The Forms component does not expose render/clear/read-only controls
that bypass the form model: consumers replace/reset the field value and use schema
availability rules. The standalone component retains its full imperative facade.

`hidden` remains a host composition decision; consumers conditionally mount the
control from field state. Numeric/string constraint inputs are not invented for
an object document. Labels and error descriptions use normal host attributes and
consumer-owned visible text. Only valid ARIA properties are applied to their
appropriate roles; the multi-block editor must not be falsely exposed as one native
textbox. Third-party tools still own their internal editing accessibility.

## Value and event rules

The field value is the authoritative requested document. The rendered editor can
lag while asynchronous work runs. It must never silently become a second authority.

| Trigger                                                  | Required outcome                                                                                                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial bind / write before loader or readiness resolves | Create/render the latest observed document; no Forms dirty/touch/change from initialization.                                                                               |
| Programmatic field write                                 | Project a detached, core-validated document into the child; do not emit a control-origin value update or editor change as feedback. Preserve existing dirty/touched flags. |
| Successful accepted editor change                        | Publish its detached document through `value.set` and forward the saved change once. Angular applies its native dirty and optional debounce rules.                         |
| Echo of that published value                             | Recognize its origin and do not render it back into the child. Use adapter origin/reference bookkeeping, not a copied deep-equality/fingerprint algorithm.                 |
| Several programmatic signal writes in one turn           | Latest stabilized state may win; signals are not a lossless queue of commands.                                                                                             |
| Invalid external document                                | Report core's `invalid-data` diagnostic, do not silently coerce it to empty or publish a replacement value. The consumer must correct its model.                           |
| Reset / authoritative newer write racing an old save     | The old result cannot overwrite the new field value or mark the reset field dirty.                                                                                         |
| Destruction                                              | Suppress late value/change/touch/error outputs; reject retained snapshot calls under the existing disposal contract; dispose the child once.                               |

An accepted editor invalidation is not proof of a physical keystroke: tools can
change their content. Dirty follows native control-origin updates; it is not a new
package-owned comparison against the initial document. Read-only transition capture
may legitimately publish an edit made before the transition. Do not drop it merely
because the field's disabled/readonly input has already become true.

## Interaction, disabled and readonly

Emit touch when focus exits the entire component boundary, including its in-holder
Editor.js toolbar. Movement between blocks or toolbar controls is not an exit.
Pointer focus and keyboard traversal follow the same rule. Readiness, rendering,
programmatic focus and disposal do not themselves mark touched. Suppress artificial
blur caused by reset/disable/teardown. A tool's externally portalled UI is outside
the supported containment boundary unless an explicit future integration defines it.

`disabled || readonly` determines the requested editor read-only mode. Capture the
initial state in the child configuration once; later changes go through the shared
ordered mode API. Do not rebuild initialization-only config on every state change.

Disabled prevents keyboard/pointer editing and removes interactive descendants from
normal focus traversal (for example through an inert owned region), while retaining
the value. Readonly prevents editing but allows reading/selection and appropriate
focus. Both allow authoritative programmatic value updates and reset. Neither clears
the document. Availability transitions must block new edits while the asynchronous
mode request is pending; rapid transitions settle on the latest requested mode.
If a mode change fails, keep interaction blocked until explicit recovery and surface
the existing error; never label an editable failure state as successfully readonly.
Do not write the failure back into the field's disabled/readonly state.

`focus()` before readiness or while disabled is a no-op and does not schedule a late
focus steal. In an editable ready control it delegates to the child; a readonly
control can focus its labelled group when there is no editable caret target. A
failure is handled through the error channel without an unhandled promise. The
existing editor focus API only accepts an `atEnd` boolean. Initially accept the
Angular `FocusOptions` signature for compatibility but document that `preventScroll`
and `focusVisible` are not forwarded to Editor.js; do not claim full option support
without an additional tested browser-adapter capability.

## Reset and race boundaries

Consumers reset with the native field-tree API and an explicit document when they
want to restore content. In the inspected Angular 22 implementation, `reset()`
without a value retains the current value while resetting interaction state; it
does not necessarily restore the original document. A model assignment alone is
not a reset of dirty/touched flags.

Angular's field reset invokes the custom-control reset hook even if the value is
unchanged. The hook must invalidate obsolete publications synchronously, then
reconcile the child with the bound value after Angular supplies it. It must not
assume the component model input already contains a newly requested reset value
when the hook is called. It must also force reconciliation when object identity is
unchanged: an in-progress editor draft can differ from the last saved model.

The current wrapper observes data changes after rendering and compares references.
Its `api.render` invalidates queued change work synchronously when ready. #551 adds
`invalidate()` and `reconcile()` to the root component for pre-ready/same-value reset
cases, backed by core invalidation. Reconciliation applies the bound input after
Angular renders; generation and queue logic remain in core. Waiting solely for an
effect, cloning a document just to trigger an input, or dropping one next change cannot prove the
reset guarantee. Test an already-running save, queued render, rapid reset/write,
reset while disabled and destruction between reset and reconciliation.

Upstream work already running cannot be forcibly cancelled. An invalidated result
can be ignored and later authoritative work applied; physical cancellation is not
a promised capability. Destruction during unresolved loader/readiness follows the
existing wrapper's deferred cleanup and no-late-output rules.

## Validation, errors and snapshot freshness

The consumer defines validation in the Angular schema. The control consumes field
state for presentation; it does not maintain its own validator registry or inject a
fake legacy `NgControl`. Structural document diagnostics come from core. Meaningful
nonempty content and tool-specific validity remain consumer/domain rules: a non-null
`{ blocks: [] }` object is not evidence that a required article contains text.

`pending` means native validation is pending. `submitting` belongs to the enclosing
form. Neither automatically represents editor loading, an in-progress save or mode
transition. Consumers compose their availability and submission rules deliberately.
Keep operational `error` events distinct from schema validation `errors`; an editor
failure must not overwrite the application's validation result.

The model represents the last successful published snapshot, subject to Angular's
configured synchronization/debounce. Clicking submit is not a guarantee that a
pending Editor.js save has completed. `save()` supplies an explicit current snapshot
for applications that need one; it does not automatically synchronize or validate
the form. Applications must validate the captured document before persisting it,
and must not assume validation of an older field value validates this new snapshot.
They own concurrent-submission prevention and server-error presentation. #551 and
#553 must exercise a real immediate-edit/submit scenario and publish a complete
example of this ordering. A fresh snapshot cannot be obtained through Editor.js save
while readonly; use the last successful model there and honor any preceding errors.

| Failure               | Value and recovery policy                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load/create/ready     | Keep the requested model; no ready or fabricated change. Recreate the owner for retry.                                                                          |
| Invalid inbound value | Keep the consumer's request visible to its form; reject rendering and report the core diagnostic. Correct the model; failed initialization requires recreation. |
| Render                | Do not roll the form back to an older editor snapshot. Report failure; explicit later write/reset can retry; do not assume upstream render failure was atomic.  |
| Save                  | Retain the last published value; no fabricated change/dirty event. A later edit or explicit snapshot request can retry.                                         |
| Read-only transition  | Preserve valid pre-transition edits; retain the requested field state; gate interaction on failure until recovery.                                              |
| Destroy               | End the owner's output lifetime; route cleanup failure through the existing Angular error handling.                                                             |

Forward an inner error once. A promise catch prevents an unhandled rejection but
must not re-emit an error already reported by the child. The form owns decisions
about blocking submission after an operation failure.

## Angular-native legacy interoperability

Use Angular's own custom-control integration for supported reactive/template-driven
bindings. Do not add `ControlValueAccessor`, `NG_VALUE_ACCESSOR` or a package-owned
`FormControl`/`FormGroup` mirror. Angular 22's published runtime includes native
custom-control wiring; #552 must test the actual bindings rather than assuming the
interfaces alone prove compatibility.

Cover direct reactive and template-driven bindings where supported, plus
`SignalFormControl.fieldTree` in a legacy form and `compatForm` where the consumer
retains legacy controls. Keep bridge imports in consumer examples, not in core or
the root wrapper. Never bind two form systems to the same control simultaneously.
Use non-null `OutputData` and explicit empty documents for reset. Consumers of
nullable legacy models own conversion at their boundary. Explicitly test/document
`updateOn` and reset behavior; do not promise every legacy option has identical
semantics. The presence of the bridge symbols on all three baselines is recorded
above; adapter runtime support is still an implementation/release gate.

## Delivery and validation map

| Subissue | Deliverable and required evidence                                                                                                                                       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #548     | This contract, source/API availability review and explicit implementation gaps. No runtime support claim.                                                               |
| #549     | APF secondary entry point and value binding; deterministic native Signal Forms tests; packed declarations; root usable without Forms.                                   |
| #550     | Touch/dirty, disabled/readonly and focus/accessibility; interaction and transition tests.                                                                               |
| #551     | Same-value reset, invalidation, validation/error/freshness semantics; async race and failure tests in the layer owning each behavior.                                   |
| #552     | Native legacy binding/bridge tests and truthful migration examples.                                                                                                     |
| #553     | Real browser Forms scenarios in the existing private `editorjs-angular-host` and `editorjs-angular-e2e` Nx projects. Library unit/contract tests stay with the library. |
| #554     | Packed Forms consumers across the three baselines, README/example verification, optional-peer boundary, release notes and evidence limits.                              |

Retain standalone tests throughout. Each implementation slice updates consumer docs
for its shipped behavior; the last slice audits completeness rather than postponing
all documentation. #69 owns full SSR/hydration, replay/pre-hydration and non-authoring
route bundle certification. Keep import safety here, add no hydration providers and
make no full hydration claim. Registry, concrete tools, uploads, persistence and
consumer adoption remain downstream.

Use one focused PR per subissue, `init` prefixes and exact comma-separated Nx project
scopes. Wait for both the maintainer's merge and explicit go-ahead before the next
subissue. Do not monitor CI, publish, bump versions or merge automatically. The
release gate still requires green checks for the intended release commit.

## Value projection implementation note (#549)

Angular Signal Forms attaches symbol-keyed tracking metadata to array items in the
model. The adapter therefore opts into core's framework-neutral normalization
policy `symbolKeys: 'omit'` when projecting inbound values. Strict defaults remain
unchanged for all other callers, including parsing/provenance. Symbols under string
keys and all other invalid JSON structures remain errors. Outgoing model values
are copied through core separately from saved change events, so Forms-owned
metadata cannot alter those events. No Angular internals or private identity keys
are referenced, and no JSON traversal is duplicated in the Angular package.

## Interaction implementation note (#550)

The adapter consumes native Forms state and delegates mode changes to the root
component's existing API. No coordinator or generic queue was added to Angular.
Initial availability is captured once in configuration; later requests remain
ordered in core. Inert gating and capture listeners cover unavailable interaction,
and composite focus tracking emits native touch. Failed/mismatched mode requests
remain gated until another availability change or recreation. FocusOptions are
accepted but ignored, as required by the initial contract.

Angular 22.1.4 suppresses computed dirty/touched while fields are non-interactive;
it retains their internal state for reactivation. Tests follow this native behavior
and preserve pre-transition saved edits. Explicit-value resets while unavailable
are covered; same-value reset and synchronous stale-work invalidation are added in #551.

## Reset and failure implementation note (#551)

Core `invalidate()` suspends publication immediately and advances the replacement
generation. Each write retains its acceptance generation so earlier queued work
cannot release a later reset. A failed render/clear remains unreconciled until an
explicit successful write; successful writes with a failed baseline save retain
the existing silent-baseline recovery. Explicit snapshots overtaken by invalidation
or a later accepted replacement reject with the additive `superseded` error code.
This deliberately tightens the previous explicit-save behavior; ordinary editor
edits after capture still belong to the caller's concurrency policy.

The root wrapper exposes `invalidate()` and `reconcile()` without Forms imports.
The Forms hook invalidates synchronously, forgets artificial focus and schedules
reconciliation after the new bound value arrives. New inbound values invalidate
when observed by the control. A lazy optional public `FORM_FIELD` lookup also
rejects stale publications/snapshots when the native model changes before input
delivery; the last observed and last published references preserve native debounce.
Model-only bindings have no field-tree reference and take effect when Angular
delivers the input; signals can coalesce before observation. The adapter continues
using core normalization and has no independent operation queue.

Native async validators and submission remain consumer-owned. Tests show strict
`ignoreValidators: 'none'` refuses a pending form rather than awaiting it. The README
single-field submission example deliberately validates its fresh captured payload
inside the action, independently of the older model's schema result. Native submit
still supplies duplicate prevention, submitting state and server-error placement.

## Native legacy interoperability boundary (#552)

The public README now specifies the tested Angular 22.0.0/22.1.4/22.2.2 migration
boundary. Direct reactive bindings, retained controls in `compatForm`, and
`SignalFormControl.fieldTree` use Angular's native integration without a package
CVA. Legacy `updateOn` modes do not defer saved editor publications. Non-nullable
editing models and explicit reset values remain the consumer's responsibility.

Legacy `FormControl.reset()` does not dispatch the editor's reset hook. Consumers
call `EditorJsControl.reset()` before legacy resets and before direct legacy writes
that can overtake editor work. `SignalFormControl.reset()` dispatches it natively.
Silent writes to retained `compatForm` controls remain unobserved until an event;
legacy imperative validator/availability APIs are not universally supported by
`SignalFormControl`.

Direct `ngModel` is not a supported clean initialization/reset path on these
baselines: its initial null causes an operational diagnostic, and a concurrent
model assignment and editor reset can leave its view/control value stale. Tests
characterize this boundary rather than adding null coercion or parallel form state.
The native contract suite runs against each isolated packed consumer. Full Forms
browser coverage and release certification remain #553 and #554.
