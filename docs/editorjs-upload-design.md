# Editor.js upload adapter contract

Contributor design for [#626](https://github.com/anarchitects/anarchitecture-community/issues/626),
the first slice of epic #72. The APIs named **planned** below are implementation
decisions for #627–#633, not available exports or new compatibility promises.
This slice changes documentation only. It neither starts the next slice nor
authorizes a release, merge, dependency update or consumer migration.

## Architecture review and baseline

Reviewed on 28 October 2026 against Community `3cf0ac8` (merged #625) and Meta
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. All eight local and eighteen Meta ADRs
were enumerated and read, including proposed, historical and superseded content.
The complete filename/status inventory in the
[registry design](editorjs-tool-registry-design.md#architecture-review-and-authority)
is unchanged. The only tracked local ADR directory is `docs/adr`.
The Modern Angular guide index, repository application, architecture, providers/
routing/HTTP, reactivity, Forms, rendering, SSR/builds, testing/migration,
validation and API ledger were reviewed, together with the Nx workspace guidance.

| Decision                                                               | Application                                                                                                                                                                               |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local 0001–0003 and Meta Governance records                            | Preserve their Governance scope and each record's status; proposals introduce no binding upload model.                                                                                    |
| Local 0004                                                             | Future API slices update and compile actual packaged consumer README examples. This planning record belongs in contributor documentation.                                                 |
| Local and Meta Modern Angular                                          | Public exports, explicit editor/request ownership, native optional Signal Forms, pure core, bounded compatibility and packed evidence.                                                    |
| Meta0008 HTTP; Meta0009 native Node; Meta0010 Nest 12; local 0005–0006 | New Nest example targets independently checked Nest 12/Fastify. Preserve existing Nest 11/Fastify SSR support; native Node remains a candidate, not the default. No adapter-parity claim. |
| Meta0011 auth; Meta0012 contracts                                      | Host owns authorization; no auth migration. Example-local wire mapping is not a new canonical cross-repository HTTP contract or storage product.                                          |
| Local0007 / Meta0013                                                   | Actual release history, exact Nx project scopes and independent first releases at 0.0.1.                                                                                                  |
| Meta0014 / Meta0015                                                    | No dependency upgrade here. Later checks need accurate inputs/output ownership, eligible cacheable atoms, fresh external-state preparation and complete DTE evidence.                     |
| Other accepted Meta records                                            | Preserve repository ownership and ecosystem implementation styles.                                                                                                                        |

No accepted-ADR conflict or exception is proposed. The Forms guide's statement
that `ignoreValidators: 'none'` waits for pending validators is not the installed
contract: the checked declarations say pending validators **block** submission.
Use the actual public API semantics already recorded in the
[Forms design](editorjs-angular-forms-design.md), not an implicit wait.
Repeat the full preflight before each implementation slice and if scope changes.

## Existing contracts to preserve

| Existing surface                                                                          | Contract                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core [upload ports](../packages/editorjs/core/src/lib/uploader.ts)                        | `FileUploader<Input, FileData, ErrorData>`, `UrlUploader<FileData, ErrorData>` and their combined `ImageUploader` remain the sole ports. `Input` is explicit; no DOM/Node types enter core.                                                                                                       |
| Core result types                                                                         | `UploadedFile` requires `url: string`; metadata extends it. `UploadSuccess<FileData>` is `success: 1` with `file` and no error; `UploadFailure<ErrorData>` is `success: 0` with optional host error and no file. `UploadResponse` is their union. Rejections remain unknown exceptions.           |
| Image [configuration](../packages/editorjs/tool-image/src/lib/image.ts)                   | Requires both methods, including readonly configuration. Browser input is `Blob`, including a `File`; code must not require a filename or narrow the port to `File`.                                                                                                                              |
| Image [browser bridge](../packages/editorjs/tool-image/src/browser.ts)                    | Calls host methods with their receiver, converts expected failures into upstream rejection with the host error as cause, validates success and normalizes saved metadata through core `normalizeOutputData`. It owns upstream notifier integration and late-preview handling. Reuse it unchanged. |
| Angular [tool providers](../packages/editorjs/angular/src/lib/editorjs-tool-providers.ts) | Environment-scoped immutable tool definitions; factories run for the environment snapshot, not once per editor. `config.tools` retains full-map precedence.                                                                                                                                       |
| Angular `/forms`                                                                          | `EditorJsControl` remains the native `FormValueControl<OutputData>`. Forms owns validation pending, errors, disabled/readonly and submission state. `save()` obtains a document snapshot; it does not await uploads.                                                                              |

Generic composition and retry preserve the original successful response and host
error payload; they must not JSON-copy arbitrary error objects or silently erase
generic metadata. Synchronous throws become rejected operation promises with the
same cause. An expected failure stays a resolved `success: 0` for direct consumers.
Only the existing image bridge translates it for the upstream image tool.

Transport decoding handles untrusted bytes before they become a typed result.
It must reject malformed JSON, a malformed discriminant/envelope, conflicting
success/error/file fields, a blank success URL and non-persistable file metadata.
Use existing core normalization for metadata, preserving valid unknown JSON
fields as a detached value. Do not add a second image notifier, public result
schema or image-specific validator to core. Host error details are not saved
document data. URL shape validation does not establish authorization, lifetime,
safe protocols or permission to fetch a resource.

## Chosen package and API ownership

| Owner / entry                                                                                                   | Smallest planned surface                                                                                                                | Why                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing `@anarchitects/editorjs-core` root; Nx `editorjs-core`                                                 | `composeImageUploader`, `createUploadOperation`, their policy/context/handle types and a local-stop diagnostic                          | Generic capability composition and bounded execution, without HTTP, DOM, Node, Angular or storage types.                                                                        |
| New `@anarchitects/editorjs-upload-fetch/browser`; Nx `editorjs-upload-fetch`; `packages/editorjs/upload-fetch` | `createFetchFileUploader`, `createFetchUrlUploader`, browser request/decoder options and transport diagnostics; `./package.json` export | One independently installable standard Fetch adapter. Explicit browser entry owns DOM declarations; no second transport or aggregate package. No root runtime facade is needed. |
| Existing `@anarchitects/editorjs-angular` root; Nx `editorjs-angular`                                           | `createEditorJsUploadOwner` and state/options types; documented host DI factory composition                                             | Signals and lifetime over the existing ports, optional without Forms. No fetch dependency, second port, upload registry or new secondary entry.                                 |
| Existing `@anarchitects/editorjs-angular/forms`                                                                 | Documented native `validate`/`submit` composition using owner signals and host error mapping                                            | No new form facade or upload-specific control. Start with a compiled recipe; a wrapper that only forwards `validate` is unnecessary.                                            |
| Existing private `editorjs-angular-e2e` fixture area                                                            | Isolated Nest 12 reference backend installation and executable example                                                                  | Keep new backend dependencies outside public packages and existing Nest 11 projects. A separate publishable Nest upload package is unjustified.                                 |

The new Fetch package is justified by its reusable concrete transport and DOM
type boundary. Putting it in core would violate purity; putting it in Angular
would force a framework dependency on generic consumers. Its only family
dependency is core; no Angular, Nest, upstream image tool or Editor.js runtime
dependency. Use an ESM browser-bundler entry with declarations. Module evaluation
must be safe without browser globals; actually executing browser requests is a
separate capability. Node transport execution and non-Chromium browser support
are not implied by import safety.

The new project/export does not exist yet. #628 must use Nx generation and the
workspace package-linking workflow, then verify its resolved name, boundaries
and tasks. This design adds no empty project. No Angular `HttpClient` adapter is
selected: a host needing its interceptor chain can inject a service implementing
the same core port. Fetch does not run Angular HTTP interceptors, and this work
must not install or replace application HTTP providers.

### Composition and unsupported capabilities

`composeImageUploader` accepts one file-capable object and one URL-capable
object, preserving their receivers and compatible input/metadata/error types.
Validate that both methods exist before use; missing capability is a construction
error, not a fallback endpoint. Do not spread a service instance or extract an
unbound method. Combining differently typed metadata/errors must retain their
types (or require an explicit host mapping), never cast them to one concrete type.

A file-only adapter is a `FileUploader`, not a partial `ImageUploader`; similarly
for URL-only. Hosts configuring ImageTool must deliberately provide both. A host
may supply a URL method that returns a typed policy-denied failure; this is an
explicit rejection, not implicit support for ingestion. No method gets fabricated
by the generic helpers.

## Operation and retry contract

`createUploadOperation` is one logical invocation, not a shared retry singleton.
It accepts an attempt callback and optional policy, starts one operation, and
returns a handle with `result` and `stop()`. The callback receives the one-based
attempt number. Separate invocations have independent counters and closures.
Capture an idempotency key in that closure before the first attempt; pass it to
host request construction on every attempt. The key is not derived from a Blob
identity and is not added to the unchanged upload port signature.

- Default: one attempt, no replay. Omitted retry policy never retries a returned
  failure, thrown exception, network error or timeout.
- Opt-in: a finite integer `maxAttempts` from 1 through 10, including the first,
  explicit `replaySafe: true`, a caller classifier, and bounded delay selection.
  Each delay is finite and between 0 and 30,000 ms; cumulative scheduled delay is
  capped at 120,000 ms. Reject invalid policy before calling the transport.
- Classifier receives a discriminated expected-failure or exception outcome and
  the completed attempt number. Success ends immediately. Malformed outcomes and
  invalid policy are terminal programming errors, not classifier candidates.
  Core checks only the result envelope needed for control flow; image metadata
  validation remains at the existing image/transport boundaries.
- Retry callbacks and delay selection must be synchronous, side-effect-free host
  policy. Their exceptions terminate the operation and remain observable. No
  arbitrary HTTP status, `Retry-After`, authorization failure, decoding failure
  or validation failure is retryable by default.
- Exhaustion returns the final expected failure unchanged or rejects with the
  final thrown cause. Do not replace it with a generic retry error. Observe each
  started promise once; no unhandled late rejection or double settlement.
- `stop()` prevents future attempts, clears a scheduled delay and rejects the
  still-pending local result with a distinct stopped diagnostic. It is idempotent
  and has no effect after settlement. A running host promise is observed but
  cannot overwrite the stopped result. Core neither aborts that promise nor
  rolls back server work. #627 must prove stop during an attempt and a delay.

Attempt/delay bounds do not bound an uncooperative transport's running time.
Without explicit stop or a transport timeout, its promise may remain pending.
Do not invent a timeout in the existing port. Callers can provide an attempt-start
observer for state accounting, invoked before the attempt callback. If it throws,
reject the result with that cause and do not start that attempt or schedule a
retry. #627 must test this terminal behavior rather than swallow application
errors.

Replay safety is a backend/host contract. A lost response can follow successful
storage. Reusing a stable key requires the backend to bind it to the authorized
principal, operation and payload, atomically deduplicate concurrent requests and
return the recorded outcome; a different payload with the same key must fail.
Merely setting a header, limiting retries or using an HTTP status does not provide
this guarantee. Retry-off remains the example default; the controlled duplicate
completion test proves the opt-in example's actual semantics.

A request builder that generates a new key on every call is not replay-safe.
For the keyed Fetch recipe, construct the adapter inside the logical operation's
closure with that operation's captured key, then invoke it on each attempt.
Do not put one permanent key on a shared uploader. An Angular owner wrapping an
arbitrary existing port cannot inject a per-operation HTTP key through that
unchanged signature: owner-level retry is permitted only when repeated port calls
already have the documented replay-safe semantics. Otherwise keep it single
attempt and let the host implement keyed retries internally; those hidden
attempts must be labelled opaque in owner state.

## Fetch adapter contract

Factories require explicit host request construction and response decoding.
They return the corresponding existing core port; compose both through core when
needed. Request options own endpoint, method, headers, credentials, encoding and
optional timeout/signal selection. Inject a Fetch-compatible request function for
tests/custom hosts, or resolve native Fetch only when invoked. Preserve its
receiver when necessary. Do not evaluate `window`, `document` or transport
constructors at module load, start requests during DI setup, or ship credentials.

File requests use `Blob`; the documented multipart recipe appends it with an
explicit host-selected fallback filename. Let `FormData`/Fetch construct the
multipart boundary; never hardcode a multipart `Content-Type`. URL requests send
the URL as data to the configured backend. Neither factory downloads the supplied
URL. Recreate request bodies per attempt; do not replay a consumed Request/body.

Check HTTP status deliberately because Fetch does not reject merely for HTTP
errors. Default non-2xx handling is a typed transport exception retaining status
without exposing a response body or secrets in its display message. A host may
explicitly map a known backend error response into `success: 0` through its
decoder; malformed/mapping errors reject. Treat decoder input as unknown and use
core metadata normalization for the resulting success. Never accept success from
an unchecked cast of `response.json()`. No automatic retries or upload-byte
progress events are supplied. These choices follow the
[Fetch response/abort model](https://fetch.spec.whatwg.org/#fetch-method).

Cancellation/timeout is adapter-specific configuration, not an added port method.
Each invocation gets its own controller and optional host-selected signal;
timeout covers request plus response consumption and cleans up timers/listeners.
The outcome must distinguish host cancellation, timeout, transport/HTTP failure
and malformed response. Abort stops local Fetch work where supported; it does
not prove the backend stopped or deleted stored data. Core `stop()` and owner
disposal are only logical cancellation unless the host deliberately connects the
adapter's signal capability. No shared controller across independent editors.

## Angular ownership, state and reset

`createEditorJsUploadOwner` takes an explicitly supplied existing uploader, policy
and the intended owner's `DestroyRef`. It creates wrappers only for supplied
capabilities and exposes readonly signals; it does not inject a global mutable
uploader or discover image blocks. Its wrappers delegate each call through the
core operation runner. Each editor gets a separate owner, even if two editors
share an application backend service. Explicit disposal remains available for
editor replacement before component destruction.

Use host Angular `useFactory`/`InjectionToken` composition to obtain the backend,
then create the owner in the editor host. No redundant provider helper is selected
for #629. A factory may capture injected dependencies synchronously, but later
request callbacks must not call `inject` outside an injection context. Component
providers can own component-local services; environment provider snapshots are
not per-editor factories. Do not store a mutable upload owner in a shared
`provideEditorJsTools` definition. Per-editor image definitions use the existing
core registry/materialization APIs and explicit `config.tools`, or an explicitly
isolated environment with matching lifetime. Never import private Angular tokens.

The owner exposes `uploader`, `busy`, `activeCount`, readonly operation records,
`acknowledge(id)`, `reset()` and `dispose()`. Records contain an opaque operation
ID, generation, file/URL kind, attempt count and terminal outcome kind; no input
Blob, URL, credentials or raw HTTP body is copied into presentation state. A host
error mapper produces safe presentation details while the returned port promise
preserves the original result/cause. Do not surface upload failures as editor
initialization errors or duplicate the image notifier.

- `activeCount` counts logical operations, including retry delays; `busy` derives
  from it. Retrying increments attempts, not active operations. Count only calls
  observed by the core runner; retries hidden inside a host service are opaque.
- Concurrent operations settle independently and may finish out of order. One
  success cannot clear another operation's unacknowledged failure. A later manual
  retry is a new operation; the host explicitly acknowledges the earlier error.
- Successful records are removed after settlement; failures remain until
  acknowledgement/reset. Bound retained diagnostic history (initial cap 100),
  with an overflow summary so eviction does not silently remove a blocking error.
  Clear retained host references after settlement; active promises retain only
  what their work needs.
- `reset()` advances the generation, stops its operation handles, clears local
  records/errors and permits new work. `dispose()` also permanently rejects new
  invocations. Neither claims to undo a backend mutation. Old completions cannot
  update signals, counters or errors in a new generation.

State reset alone cannot invalidate an already-running ImageTool callback.
For document replacement/form reset, first dispose the old editor/tool generation,
reset/dispose its upload owner, and create the replacement with a fresh owner and
configuration. Apply this even for a same-value reset. Reuse the existing image
bridge's removal guard; do not promise that resetting a signal cancels image UI
work. #629/#630 must prove held success and failure after reset, destruction and
remount, including two owners sharing one backend service.

## Native Signal Forms composition

Keep `EditorJsControl.pending` as native validation pending. Upload busy belongs
in host UI (`aria-busy`, a status message and deliberate submit availability),
independent of validation and `submitting`. Do not bind over `[formField]`'s owned
inputs, set its errors imperatively, introduce a CVA, or force upload state into
generic packages.

The initial optional recipe uses native `validate` with a callback reading owner
signals. A host-selected blocking policy returns a safe `upload-busy` error while
active and mapped `upload-failed` errors for relevant unacknowledged failures;
otherwise it returns no upload error. This composes with other validators and
does not replace server/form errors. Busy is an explicit validation rule here,
not fabricated asynchronous-validation pending. Nonblocking presentation is also
valid when chosen by the host. The host decides which failure remains relevant
after deleting an image and acknowledges it explicitly.

The documented submit recipe **rejects/blocks while busy**, rather than awaiting
uploads implicitly. Acquire a host submission guard before asynchronous work,
prevent new editing/uploads for that attempt, recheck owner generation/activity,
obtain the authoritative editor snapshot, and submit through native `submit` with
`ignoreValidators: 'none'`. Release the guard on every exit. Disable pre-hydration
submission until the editor/owner is ready. Programmatic calls need the same
guard as the button; disabled markup alone is insufficient. Existing validators
and `submitting` retain their own meanings. No new wait-for-uploads API is planned.

#630 must test dirty/touched preservation, disabled/readonly policy, simultaneous
uploads, independent validators, duplicate submit, error acknowledgement, failure
recovery, reset including same-value reset, and late work after replacement.
File/URL content must retain caption, metadata and the three-way alt contract
(unset, authored description, decorative empty string). No default behavior
changes for consumers that do not opt into this composition.

## Compatibility selection and evidence

The existing [#616 packed evidence](editorjs-common-tools-release-readiness.md)
is the regression baseline, not evidence that the new uploads already work.

| Cell                       | Angular packages | Node    | TypeScript | Editor.js |
| -------------------------- | ---------------- | ------- | ---------- | --------- |
| minimum                    | 22.0.0           | 22.22.3 | 6.0.3      | 2.31.7    |
| reference                  | 22.1.4           | 24.15.0 | 6.0.3      | 2.31.7    |
| current (pinned cell name) | 22.2.2           | 26.0.0  | 6.0.3      | 2.31.7    |

Keep all three CSR/SSR cells. Angular 22.2.3 is now published; that observation
does not update the pinned current cell or broaden evidence. Core retains Node
22.12.0 minimum and ES2022-only declaration checks. Browser evidence remains
Playwright 1.64.0 / Chromium 156.0.8078.4, revision 1248. Image uses upstream
`@editorjs/image` 2.10.3. No Firefox/WebKit, all-browser, Node Fetch execution,
automatic upload-progress or production-storage certification is claimed.

On 28 October, published Forms archives for all three cells were inspected:
they export `validate` on `@angular/forms/signals`, declare the path-plus-validator
signature, and expose `submit` with `ignoreValidators` choices. The declaration
comments identify `'none'` as blocking pending validation. This verifies API
availability; reactive recipe behavior still requires #630's packed runtime
tests. Current primary references: [validate](https://angular.dev/api/forms/signals/validate)
and [submit](https://angular.dev/api/forms/signals/submit).

| Inspected archive       | SHA-256                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| `@angular/forms` 22.0.0 | `215a48539c7b87b2f7eb886fe61b274b95990c336718cea42ef3ca00547b9663` |
| `@angular/forms` 22.1.4 | `2fb70f3e29beeff02f7fcd6771cc35258b3a7e550a102210f450e6db2d26343c` |
| `@angular/forms` 22.2.2 | `74c71381db25f374b4bbd727a44b58c18300bdb8e0f960bccae138e8cf2b86cb` |

### Optional Nest reference target

Select `@nestjs/common`, `@nestjs/core` and `@nestjs/platform-fastify` **12.3.2**,
Fastify **5.12.7**, `@fastify/multipart` **10.1.6**, Node **24.15.0** and TypeScript
**6.0.3** for #631's isolated example. Registry metadata confirms the platform's
exact Fastify dependency and `^10.1.0` multipart peer; the inspected multipart
plugin declares Fastify `5.x`. Nest core declares Node `>=20`. This is a selected
compatible dependency/API target, not a claim that #631's endpoint has run.

The platform archive exports `@nestjs/platform-fastify/multipart` and declares
`FileInterceptor(fieldName, options)`, `MultipartOptions` with parser limits,
and the uploaded-file types. The [official Nest upload documentation](https://docs.nestjs.com/techniques/file-upload)
describes this Fastify integration and automatic plugin registration. Use these
Fastify presentation APIs, not Express interceptors or assumed Nest 11 APIs.

Primary registry records:
[`core` 12.3.2](https://registry.npmjs.org/@nestjs/core/12.3.2),
[`common` 12.3.2](https://registry.npmjs.org/@nestjs/common/12.3.2),
[`platform-fastify` 12.3.2](https://registry.npmjs.org/@nestjs/platform-fastify/12.3.2),
[`multipart` 10.1.6](https://registry.npmjs.org/@fastify/multipart/10.1.6).
Inspected archive SHA-256: platform
`4ac2c18fed1d96b2ab8ec422c9b99bb4c71900f64cfce86929613ad918adca29`;
multipart `c852cdc41852008e893f9e58efb2f80c0c5661b043fa3c47568b723dc567471b`.
Resolve and record remaining exact fixture dependencies/lock at #631; run the
documented endpoint through the packed adapter before calling it tested.

The endpoint is example-local: authenticated bounded multipart file submission
and URL submission mapped to the existing result contract. The host owns identity,
authorization, quotas, parser/body limits, content inspection, filename/storage
key selection, durable storage, cleanup, public URL lifetime and error redaction.
The controlled fixture uses local data and an explicit URL allowlist/stub;
it is not an unrestricted URL fetch proxy. A production ingest service needs
its own redirect/DNS/network policy and resource bounds. The example's idempotency
store is isolated test infrastructure, not a durable production implementation.
Keep parsing/HTTP details in presentation and storage policy behind a host seam.

## Delivery and acceptance mapping

Each row is one focused PR after its predecessor merges and the maintainer
explicitly starts it. #626 does not start #627 automatically.

| Slice | Deliverable and required evidence                                                                                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #626  | This ownership/API/compatibility contract, baseline inventory and acceptance mapping. No runtime package, dependency, public README promise or version change.                                                                 |
| #627  | Core composition/operation helpers: generic inference, receivers, typed failure versus rejection, malformed/config errors, concurrency, bounded retry, stop during delay/work, no dangling rejection; ES2022-only packed root. |
| #628  | One Fetch adapter: real controlled HTTP, Blob without name, URL submission, status/JSON/metadata errors, timeout/abort, replay-safe duplicate completion; non-Angular packed ImageTool and alt round trip.                     |
| #629  | Angular DI recipe and per-owner state: two standalone editors, held uploads, retry counts, safe errors, acknowledgement, reset/disposal/remount, Forms absent, public routes with no eager delivery.                           |
| #630  | Native Forms recipe on all three cells: host submit guard, independent errors/state, fresh saved data, same-value reset and late completion, accessible UI and alt/caption/metadata preservation.                              |
| #631  | Execute isolated Nest 12/Fastify endpoint example with exact dependencies; bounded parser/policy, authorization and rejection mapping, URL stub and idempotency evidence. Preserve existing SSR adapter support.               |
| #632  | Full packed generic/Angular/Forms, CSR/SSR/hydration/isolation and Nx cache restoration/DTE evidence; no shared mutable worker output or omitted atoms.                                                                        |
| #633  | Final READMEs, compiled archive examples, matrix/evidence/limitations and release readiness based on actual artifacts; publication remains separate.                                                                           |

Every API slice owns its public README and meaningful tests immediately; #632
and #633 consolidate evidence rather than defer correctness/documentation.
Use public packed exports, no source aliases or monorepo-only dependency leakage.
Resolve actual Nx targets before running them. Existing scopes are `editorjs-core`,
`editorjs-tool-image`, `editorjs-angular`, `editorjs-angular-host` and
`editorjs-angular-e2e`; `editorjs-upload-fetch` becomes valid only after creation.

On this baseline, the resolved e2e project has 85 targets, including six uncached
`packed-{csr,ssr}-angular22-{minimum,reference,current}-prepare` targets and
`e2e-packed` / `e2e-packed-ssr` uncached coordinators. Existing distributed
evidence is 69 cacheable atoms and six coordinator collection gates. Extend that
graph with real upload cases; do not treat successful aggregation as evidence
that every intended atom ran. Preserve source/runtime/archive identity checks,
worker-local fixture isolation and independent output/report paths. Registry
install freshness remains uncached preparation; distributable atoms consume
immutable prepared evidence without depending on uncached agent tasks.

The #616 record identifies typecheck/build declaration output overlap. Complete
emitting checks before the final build/pack until output ownership is corrected;
do not launch overlapping writers in independent Nx invocations. #632 must prove
that restored artifacts and distributed tasks correspond to the same inputs.

The [28 October release inventory](editorjs-common-tools-release-readiness.md)
records the Editor.js family as unreleased (registry absence, no package release
tags or GitHub releases); manifests are 0.0.1. Registry reads for core, Angular,
image and the proposed Fetch package again returned 404 during this review.
This design-only contributor change
uses an unscoped `docs` commit. Implementation slices recheck actual distribution
history and use `init` with exact affected Nx scopes while unreleased. No bump,
publication, automatic merge or downstream adoption is included.
