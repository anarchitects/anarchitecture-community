# Editor.js HTML adversarial validation

Evidence for #684, based on merged #683 (`fc9c8ea`), reviewed 4 November 2026.
The consumer contract belongs in the [package README](../packages/editorjs/html/README.md).

## Architecture preflight

All nine Community and eighteen Meta ADRs were read during the preceding slice.
For this slice, both inventories were enumerated again and verified unchanged;
Meta's fresh remote tree matches the clean adjacent checkout at
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. The renderer ADR was reread, alongside
the Modern Angular index, repository application, architecture and testing guides.
The previously reviewed core development and custom-tool guides remain unchanged.

Community0008 retains the private sanitize-html 2.18.1 adapter, neutral runtime,
finite semantic mapping, strict publication and explicit incomplete preview.
Parser hooks may enforce policy; no second HTML parser, sanitizer, AST or runtime
dependency is introduced. No accepted conflict or exception was identified.
Governance proposals retain their status. HTTP/Nest contracts are unaffected.
Angular implementation and its actual binding/SSR proof remain subsequent slices.

Community0004 requires complete packaged guidance and runnable public examples.
Community0007/Meta0013 require fresh history and the exact project commit scope:
npm returned E404, no remote editorjs-html tags exist, and none of the 102 GitHub
Releases identifies an Editor.js distribution. Retain 0.0.1 and
`init(editorjs-html)`. Meta0015 requires declared inputs, independent test atoms,
restorable outputs and uncached fresh consumer installs. No hosted experiment or
CI monitoring is authorized by this work.

## Findings and changes

Before hardening, strict custom output accepted orphan `li`/`figcaption`, non-item
list children, duplicate/middle figure captions and block descendants of phrasing
containers. The first regression run had 30 failures across custom, override and
tune routes; all 378 attack-path combinations already rejected unsafe publication.
The finite sanitizer allowlist was necessary but did not enforce content models.

Bounded parser-hook state now checks list parenting, direct list text, figure
caption position/count and phrasing descendants. It does not build an HTML tree.
Malformed final fragments report `unsafe_html`, fail strict publication and omit
the entire affected block in preview. A later tune cannot erase that omission.
Valid transparent block links, nested figures, caption-first/last figures, nested
lists and literal pre/code remain supported. This is deliberately a policy for
the supported vocabulary, not a universal HTML conformance checker.

Exceeding the fixed 32-element HTML nesting ceiling now reports `limit_exceeded`
without HTML in either mode, instead of returning a truncated preview as though
only an unsafe tag had been removed. JSON/list/output ceilings retain their
existing contracts. No timeout or supported safety floor is loosened.

Content-model references: [WHATWG grouping content](https://html.spec.whatwg.org/multipage/grouping-content.html)
and [text-level semantics](https://html.spec.whatwg.org/multipage/text-level-semantics.html).
The installed sanitizer identifies its maintained source as
[Apostrophe's sanitize-html package](https://github.com/apostrophecms/apostrophe/tree/main/packages/sanitize-html),
not the archived standalone repository. The exact installed parser hooks were
reviewed; upstream owns parsing and escaping.

## Corpus and observation

`tests/adversarial-fixtures.ts` supplies the same attack data and route construction
to Vitest and the packed Chromium harness. It imports renderer types only; browser
execution calls the public function from the freshly installed archive.

- 27 attacks × 14 routes: five standard profiles, five configured aliases,
  custom output, explicit paragraph override, tune replacement and bounded inline
  helper. Quote text/caption and image caption are exercised. Cases cover events,
  script, CSS URLs, target/rel, clobbering attributes, mixed/entity/control/encoded
  protocols, credentials, SVG/MathML mutation, raw-text/RCDATA, iframe/template,
  misnesting and incomplete markup.
- 10 invalid content models × custom/override/tune. Separate positive cases retain
  valid formatting and structure. Diagnostics are repeated for determinism;
  failed strict results expose no HTML.
- Real default byte/block/string/depth/output ceilings, 1,000 nested HTML elements,
  malformed JSON/envelopes, UTF-8 multibyte strings and explicit preview failures.
  Existing suites cover lowered list limits, accessors, cycles, sparse data,
  stable path ordering, diagnostic truncation and callback recovery.
- All 15 class keys accept configured tokens, reject unsafe configuration, remove
  no safety controls and cannot authorize inline CSS. URL options retain their
  existing relative/scheme/origin/mailto tests, with image obfuscation tested
  through native/aliased/custom/override/tune paths.
- Chromium parses 756 attack cases (default and narrowed origin policy), then
  serializes/reparses each into a normal flow container. It checks namespaces,
  active tags, attributes and link destinations, clicks surviving anchors, waits
  for image completion and inspects an execution sentinel. Requests are observed
  and aborted; the actual URL set must match approved surviving image DOM.
  Default preview may retain an HTTP image after removing its event handler;
  origin narrowing prevents the attack-origin requests. The raw unsafe-image
  control must produce a request and execute its error handler.
- Actual DOM and accessibility snapshots verify heading level, named link,
  quotation/attribution, independent caption and alt, one authored image and a
  decorative image excluded from the accessibility tree. The preceding packed
  checks still verify list start/type, read-only checklist state, literal Code,
  attribute-looking alt and absence of editable controls.
- The packed Node import traps browser globals, fetch/XHR/WebSocket and Node
  HTTP(S) request/get while rendering an allowed image. Built-ins perform no I/O.

## Completed local evidence

Node 22.12.0 and 24.22.2 on macOS arm64 pass build, typecheck, lint and all
598 tests (445 adversarial/configuration/boundary cases plus the existing 153).
Both fresh packed installs pass the guarded Node import, public NodeNext/Bundler
ES2022-only declaration checks and all six compiled/executed README examples.
Both run 756 Chromium attack cases, 30 semantic omission cases and accessibility
assertions. Archived documentation equals source; private subpaths and
framework/authoring dependency leakage remain rejected.

Toolchain: Yarn 4.18.0, TypeScript 6.0.3, Vite 8.0.9, Vitest 4.0.18,
esbuild 0.28.2, Playwright 1.64.0, Chromium 156.0.8078.4 (revision 1248).
The installed browser bundle is 182,247 minified bytes before compression.
Fresh runtime closure (identical in both consumers): `dayjs 1.11.23`, `dom-serializer 3.1.1`, `domelementtype 3.0.0`, `domhandler 6.0.1`, `domutils 4.0.2`, `entities 8.1.0`, `escape-string-regexp 4.0.0`, `htmlparser2 12.0.0`, `is-plain-object 5.1.0`, `launder 1.7.2`, `nanoid 3.3.20`, `parse-srcset 1.0.2`, `picocolors 1.1.1`, `postcss 8.5.32`, `sanitize-html 2.18.1`, `source-map-js 1.2.2`.
Core and HTML are independently versioned 0.0.1 archives.

| Runtime | Core archive SHA-256 | HTML archive SHA-256 | Installed lock SHA-256 |
| --- | --- | --- | --- |
| v22.12.0 | `520109a794427793a2370fe73bfe74ef5a95a4cd51fec04a1992e2803a9e2a13` | `71cf753ad7c58a157115b61994e6cf91ec23c04068ba8aece18a7e4a58d4b437` | `55856c64b5869a656474887b1fdc10973638cbaa1d3453de017c6559d81dd03d` |
| v24.22.2 | `af9c399df59a106dc03a03dca40c91a524afb2fc404b25a0f0ad9d0cb1867c22` | `0981a3584bb22506ed17ffa3bae04666bd0dbe7001a601779e447fa7a14c3f34` | `e15d59e177b54aad964a01ba4fc384f5de5a1d81955241ac036a58bc5488b54d` |

The new per-file atom has the same build prerequisites and source/dependency,
lock/configuration, exact Node/platform/architecture and environment inputs as the
existing five atoms, with its own coverage output. The shared fixture is inside
the project source inputs; source changes invalidated the atom, and Node 22/24
produced distinct runtime hashes. Repeating the Node 22 adversarial target hit
8/8 local tasks. Removing generated HTML build output and restoring from cache
returned all 17 files byte-for-byte (7/7 local hits). Fresh packed installs remain
uncached and were executed separately after successful build prerequisites using
`--excludeTaskDependencies` to avoid the local runner stall. No graph prerequisite
was removed and no DTE, remote-cache or CI result is inferred from these checks.

## Reproduction and limits

Use workspace Yarn 4.18.0. Run build first, then individual targets with
`NX_NO_CLOUD=true NX_DAEMON=false NX_ISOLATE_PLUGINS=false` (the local sandbox also
requires `NX_NATIVE_COMMAND_RUNNER=false`):

```sh
yarn nx run editorjs-html:build
for file in adversarial conformance extensions profiles renderer security; do
  yarn nx run "editorjs-html:test-ci--tests/$file.spec.ts"
done
yarn nx run editorjs-html:typecheck
yarn nx run editorjs-html:lint
yarn nx run editorjs-html:packed-smoke:browser
```

Fresh install/browser execution needs local network and Chromium permission.
The aggregate test-ci target requires Nx Cloud in the installed toolchain, so
these commands invoke its individual file atoms. The local Nx runner also emitted
an `env: undefined` schema error when a build and test were first scheduled together;
separate build and test invocations completed the checks. No cloud retry or
configuration relaxation was used.

These cases are regression evidence, not a complete security audit or universal
browser certification. Trusted callbacks can run arbitrary JS, allocate, fetch or
block the event loop; the renderer cannot sandbox them. Sanitizer/transitive
updates need this corpus rerun. Chromium coverage does not imply Firefox/WebKit,
Angular sanitization, SSR/hydration or the broader #687 support matrix.

Hosts must supply meaningful heading order, link text, alt and editorial content;
choose image hosting/privacy/CSP and navigation policy; and insert output into an
appropriate flow container. Never insert it as script/style/attribute content or
append unsanitized content. Host CSS, third-party DOM mutations, URL redirects and
permitted remote resources remain outside the renderer's guarantees. Preview
omissions and transformations must remain visible and must never authorize publication.
