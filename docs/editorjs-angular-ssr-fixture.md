# Editor.js Angular server fixture

This private fixture implements the server evidence slice (#563) of the
[SSR contract](editorjs-angular-ssr-design.md). **Server-render success is not
hydration certification.** Browser node reuse, event replay, delayed activation,
pre-hydration interaction, lazy browser delivery and the packed SSR version matrix
remain the subsequent slices. Public package support claims are unchanged.

## Architecture review

On 2026-10-12, all seven local ADRs and all fourteen Meta ADR records were enumerated
and read, including the historical landscape record and the proposed cooperative
enrichment, governance hierarchy, Archi and workspace-layering decisions. Meta was
reviewed at `e97790c4721099c3d75a5cb82a8afb0cbc122ed9`.

The accepted local and Meta Modern Angular A01–A12 rules require standalone public
entry points, native Signal Forms, explicit state ownership, supported SSR APIs,
matching initial markup and behavioral evidence. Local ADR 0004 keeps fixture and
validation instructions here rather than in the public README. Governance ADRs
0001–0003 retain their package-specific scope. Local ADRs 0005–0006 and Meta HTTP,
Native Node candidate, Nest-first and authentication migration decisions preserve
existing Nest compatibility: this fixture introduces no Nest integration or default
change. The other accepted Meta records preserve repository ownership and the two
core architecture styles. Proposals do not override accepted decisions. No conflict
or exception is required, including for the narrow Forms attribute fix below.

The Modern Angular guide's repository application, architecture, provider/routing,
reactivity, Forms, rendering, SSR/builds, testing and API ledger were reviewed.
The Angular MCP best-practices endpoint returned `Unexpected response type`;
accepted guides, [official SSR documentation](https://angular.dev/guide/ssr) and
installed public declarations supplied the implementation guidance.

## Composition and commands

Use the pinned Yarn workspace and install with `yarn install --immutable`.
From the repository root:

```sh
yarn nx run editorjs-angular-host:build-ssr
yarn nx run editorjs-angular-host:serve-ssr
yarn nx run editorjs-angular-e2e:test-ssr
yarn nx run-many -p editorjs-angular-host,editorjs-angular-e2e -t typecheck,typecheck-ssr,lint
yarn nx run-many -p editorjs-core,editorjs-angular -t test
yarn nx run editorjs-angular-e2e:e2e
```

`serve-ssr` uses `http://127.0.0.1:4319` (or `PORT`) and terminates with SIGTERM.
The automated server suite allocates its own port, waits for its owned process's
readiness record and health response, and never reuses a developer server. It
asserts a clean process exit, server-close callback and closed listening socket.
A five-second shutdown deadline kills a stuck process and fails the assertion.

| Route                | Rendering   | Content                                 |
| -------------------- | ----------- | --------------------------------------- |
| `/`                  | Request SSR | Lightweight public page                 |
| `/standalone`        | Request SSR | Public root editor entry                |
| `/forms`             | Request SSR | Optional native Signal Forms entry      |
| `/sample/public`     | Prerender   | Fixed public page                       |
| `/sample/standalone` | Prerender   | Fixed synthetic document                |
| `/sample/forms`      | Prerender   | Fixed synthetic document and form state |

Request authoring routes accept a bounded synthetic `marker`, `disabled=true` and
`readonly=true`. For example, `/forms?marker=review-a&disabled=true`.
Prerender samples ignore these query parameters. No authentication or persistence
is provided; `/fixture-submit` records unexpected native submission and returns
409 without storing data. This is a loopback test host, not a deployment template.

The Nx `setup-ssr` generator supplied the Angular application-builder/server
bootstrap conventions. Its generated configuration was separated into `build-ssr`
and `src/ssr`, preserving the existing CSR bootstrap, targets and output directory.
The generated Express example was adapted to the public Angular Node handler with
Node HTTP so the private fixture needs no additional web-framework dependency.
The public editor dependencies were already linked by Yarn; no new workspace link,
package, dependency upgrade or publishable harness was needed.

`build-ssr` explicitly depends on library builds and writes
`dist/apps/editorjs/angular-host-ssr`. Its cache inputs include source/dependency
production inputs, TypeScript configuration, the lockfile and Node version.
`serve-ssr` depends on that build and is continuous/uncached. `test-ssr` explicitly
depends on the SSR build and is uncached so process, socket and overlap evidence
is rerun on every invocation. Existing CSR and packed-CSR targets remain separate;
the packed-CSR consumer excludes the new SSR source roots from its compilation.

## Request ownership and evidence

The host installs `provideClientHydration(withNoHttpTransferCache())` and lazy
routes. Each authoring component provides its own request state and an observer of
the package's real loader. The observer delegates to the public parent loader;
it does not substitute an SSR mock. Every owner gets detached document data and,
for Forms, a new signal model and native field tree. Angular `TransferState`
serializes only the synthetic document, marker and initial disabled/readonly flags.
The browser consumes and removes that key. Credentials, cookies, diagnostics,
callbacks and pending tasks are never transferred.

Server HTML contains stable labels/status placeholders and empty editor holders.
Forms has a disabled fieldset until editor readiness, a safe POST action and an
inert custom editing region. The tests exposed that the adapter's DOM `inert`
property binding alone was not serialized by server rendering. An explicit inert
attribute binding now accompanies the property binding; it is removed on activation
or re-enablement. This restores the existing unavailable-region contract without
new public APIs, hydration providers or a second lifecycle coordinator.

The server suite asserts:

- Real production HTTP SSR for public, standalone and Forms routes; deterministic
  repeated responses; all three generated prerender documents and their HTTP output.
- Empty holders without tool DOM, contenteditable surfaces or toolbars; Forms
  availability attributes and untouched, pristine, non-pending/non-submitting state.
- Sequential A/B/A requests and two simultaneous Angular owners for each authoring
  route, with distinct documents and form flags and no marker/state contamination.
- Correct escaping of closing-script text, angle brackets, quotes, ampersands and a
  Unicode line separator through Angular transfer serialization. Synthetic secret
  sentinels in authorization/cookie headers never appear in HTML.
- Zero loader invocations/instances and destruction of each component-owned state
  and loader provider. Angular schedules platform destruction after rendering;
  assertions await actual `DestroyRef` callbacks rather than inferring disposal
  from response completion or forcing application destruction.
- A Node module-load guard rejects the actual Editor.js-containing server outputs
  identified by the builder's input/output graph. The real server succeeds with
  that guard; a deliberate import fails, proving the detection control works.
  No browser-global shims are installed in the server. JSDOM only parses captured
  HTML in the separate test process and never executes response scripts.

The bounded request delay is test instrumentation for overlapping live Angular
applications, not a browser initialization or hydration timing policy. Tests verify
that the second owner exists before the first response finishes. Server errors and
rejections remain visible and fail the suite; no diagnostic suppression is used.

Evidence is retained in `apps/editorjs/angular-e2e/test-output/ssr`: HTTP and
prerender HTML, server logs, import-guard negative control, build statistics,
actual versions and the workspace lockfile. Nx retains build failures in task
output; a failed dependency prevents the test from running. Generated artifacts
are ignored by Git.

## Validation boundary

The workspace runtime is Angular 22.1.4 (including Forms/platform-server), with
build/SSR tooling 22.1.6 and Node 24.21.0 at validation. This is workspace evidence,
not the matched three-cell packed SSR matrix planned in #567. Existing package
checks retain root-only operation without Angular Forms or installed Editor.js and
core declarations without Angular/browser dependencies. Existing CSR browser
coverage is retained. No merge, release, version bump or automatic CI monitoring
is part of this slice.
