# ADR0008: Safe Editor.js HTML rendering and optional Angular presentation

- Status: **Accepted**
- Date: 2026-10-31
- Accepted: 2026-10-31, by Johan Vrolix (explicit maintainer instruction)
- Owners: Community maintainers
- Scope: #650; design/research #681; implementation #682–#688
- Evidence: [reproducible adoption research](../editorjs-html-research.md)
- Supersedes: none

## Context

Community's completed #66–#74 contracts describe portable saved Editor.js data,
authoring tools, custom extensions and consumer-owned persistence. They do not
make arbitrary saved strings safe to bind as HTML. Public blog/display routes
need semantic HTML without importing the editor or Angular authoring integration.

The bounded spike found current general-purpose renderers lose our top-level
image alt distinction and list metadata, lack our strict diagnostic contract, and
emit executable HTML through ordinary/custom paths. Adding a sanitizer alone
cannot restore lost semantics. See the research for versions, license/dependency
evidence, counterexamples and limits; this ADR does not claim a full security audit.

## Decision

Create independently versioned `@anarchitects/editorjs-html` and
`@anarchitects/editorjs-html-angular`. Implement only saved-block mapping and our
policy/result API ourselves. Reuse core structural parsing/validation and
`sanitize-html@2.18.1` behind a **private** adapter for HTML parsing/sanitization;
do not build another HTML parser, sanitizer engine, universal AST or editor
registry. No production dependency or package is introduced by this ADR.

The sanitizer's Node >=22.12.0 floor is compatible with the selected neutral
floor. Its measured browser probe is about 157 kB minified before compression;
accepting that cost is part of this decision, not an incidental implementation
choice. #687 measures real application cost. A change of sanitizer, relaxation of
the safety floor or materially different supported profile requires a recorded
design review and affected proof, not a silent implementation substitution.

## Neutral package and validation boundaries

The headless package depends on core and its selected sanitizer. Its public
runtime/types must not require Angular, Forms, Nest, Nx, GrapesJS, the Editor.js
browser runtime or browser tool classes. Public API names below are the planned
seams to stabilize through #682/#683 type tests, not already available imports.

- `renderEditorJsHtml(input, options?)` is synchronous and returns a discriminated
  result; no throwing for expected invalid content, I/O, implicit fetch, clocks,
  random identifiers or process-global configuration.
- `createEditorJsHtmlRenderer(options?)` captures an immutable configuration
  snapshot for repeated calls. A separate instance/call cannot modify it.
- `HtmlRendererOptions`, `HtmlRenderResult`, `HtmlDiagnostic` and typed
  block/tune registration contracts expose Community concepts, not sanitizer
  option types or upstream renderer objects.
- Core `parseOutputData`/`validateOutputData` own JSON/envelope/ID validation.
  Normalize only where explicitly requested for decoded authoring values; do not
  silently migrate stored data. The host extracts any persistence envelope and
  applies its own migration/provenance/version policy before rendering.

Reuse neutral tool validators through their **public roots** when supplied by a
host or in development conformance tests. Their current package manifests also
install authoring tool/runtime dependencies despite neutral entry points. Thus
the renderer must not depend on those packages just to obtain validators, or
import their private source. Its built-in profile owns the narrower renderability
guards using core's `ToolDataValidator` protocol, checked against shared fixtures
and public tool validators in development. An extraction of shared neutral
validators, if later justified, needs its own compatibility review; #681 does not
authorize moving existing APIs or widening core into a tool-specific schema catalog.

## Results and publication policy

Default mode is `strict`. A complete valid document returns a result with
`status: 'success'` and `html`. An empty valid block array succeeds with empty HTML.
Any invalid structure, unsupported/unknown block or tune, invalid saved data,
missing image alt, rejected unsafe content, callback failure or exceeded limit
returns `status: 'failure'`, diagnostics and **no html property**. It cannot expose
the successful prefix as a publishable document.

Explicit `preview` mode returns `status: 'preview'`, safe `html` and diagnostics;
it never masquerades as publish success, even with no omissions. Structurally
invalid documents still fail without output. Invalid/unknown blocks and blocks
with unknown/invalid tunes are skipped as whole blocks. Missing-alt images are
skipped, not changed into decorative images. Recognized blocks containing unsafe
markup may render the sanitized remainder with explicit diagnostics. Every
preview omission/transformation is observable; hosts choose how to display it.

Diagnostics have stable machine codes, stage, block index and optional saved ID,
configured type/tune and data path. Order is document order, then path/stage order.
Never include arbitrary saved text, URLs, stack traces or callback exception text
in routine diagnostics. Distinguish structure, unsupported profile, invalid data,
missing alt, disallowed content, callback failure and resource limits. Publication
authorization, editorial quality and meaningful accessibility remain host duties
even after a successful strict render.

## Saved profiles and extension contracts

The first #682 profile is paragraph, header and quote; #683 adds the remaining
standard profile. Unsupported later blocks fail explicitly until implemented.

| Saved profile   | Output contract                                                                                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paragraph       | p with permitted inline formatting; no automatic text-to-HTML guessing.                                                                                                                                                                                              |
| Header          | h1–h6 for validated level; no clamping or hierarchy rewriting. Host owns heading hierarchy.                                                                                                                                                                          |
| Quote           | Semantic quotation and separate attribution/caption; center/left maps to bounded classes, not arbitrary inline CSS.                                                                                                                                                  |
| Current list v2 | ul/ol with recursive li; preserve validated start and numeric/roman/alpha counter semantics at each level. Checklist uses a documented accessible read-only state, not an editable form control. Prove the final DOM/accessibility choice in #683/#684.              |
| Image           | figure/img and nonempty figcaption; caption allows permitted inline markup. `alt` is plain attribute text. Authored nonblank text and explicit empty decorative text remain distinct; missing or whitespace-only alt cannot publish. No caption/file-name inference. |

The supported list contract is the current saved shape used with list 2.0.9,
not an implicit promise for every historical Editor.js list release. Legacy
flat strings require a host migration or a separately named opt-in profile with
its own guard and fixtures; no automatic fallback belongs in the initial profile.

Registries are keyed by **configured saved names**, backed by own-key lookup/Map,
never prototype lookup. Alias and override registration is explicit. Duplicate
entries fail configuration; overriding a built-in requires explicit intent.
Registrations supply saved-data guards plus synchronous rendering callbacks.
Generic types connect a saved-name/data map to callback inputs; runtime guards
still validate persisted unknown data. Core authoring `ToolConstructor` and
mutable authoring registries are not part of this API.

Callbacks receive detached, deeply frozen JSON data/block context and bounded
helpers, never a DOM, injector or editor API. Registered tunes validate their own
saved payload and compose in declared registration order. Unknown tunes fail;
an intentionally nonvisual tune must be explicitly registered as validated and
ignored. Tune wrappers and overridden built-ins enter the same output boundary.
Returning a promise, non-string output or throwing produces a controlled error.
Arbitrary callbacks are **trusted application code**, not sandboxed plugins.

#73 Callout (`text`, `tone`), Marker inline markup, FlagTune (`flagged`) and literal
Code (`code`) are extension demonstrations, not mandatory additional block tools.
Code must escape its content as literal pre/code text before the common boundary.
The registry owns none of authoring lifecycle, tool construction, uploader,
persistence, credentials or application publication schema.

## Threat model and common HTML boundary

Treat saved JSON, text, inline markup, captions, alt, metadata and URL strings as
untrusted. Also treat **returned callback HTML** as untrusted markup even though
the callback's JavaScript is trusted code. Sanitization cannot prevent a callback
from fetching data, mutating globals or blocking the event loop; hosts must not
load arbitrary user-authored JavaScript as renderers.

The pipeline is: bound input → core structural validation → configured saved
profile/tune guards → deterministic semantic formatting with context-appropriate
escaping → one common sanitizer policy → bounded final result. Plain text and
attribute values are escaped; supported inline fields are parsed/sanitized, never
blindly escaped twice. Custom fragments cannot opt out. Policy checks may inspect
the maintained parser's tokens/hooks; no regex-only HTML parsing or sanitizer fork.

- Permit a finite semantic/inline tag set needed by the implemented profile.
  Reject active elements, script, iframe/embed/object, forms, SVG/MathML and other
  namespaces, event attributes, arbitrary data attributes and uncontrolled IDs.
- Use explicit per-tag attributes. Alt remains plain text. List counters/start
  are validated semantic values. No arbitrary attribute passthrough from JSON.
- Permit absolute https/http URLs and well-defined relative/fragment links under
  a documented URL parser/policy. Hosts may narrow schemes/origins and permit
  mailto for links explicitly. Reject javascript/vbscript/file/data/blob schemes,
  protocol-relative URLs and control/encoding obfuscation; validate decoded URL
  meaning and serialize safely. Do not base safety on a string prefix check.
- Images use approved http(s) or explicitly configured relative asset URLs.
  Rendering performs no server requests. Browser image loading, navigation,
  tracking/privacy, asset authorization and CSP remain host concerns. No automatic
  remote image optimization or URL reachability test.
- Links do not open a new tab by default. An explicit permitted `_blank` policy
  adds safe rel tokens; arbitrary target/rel combinations are not passed through.
- Styling means opt-in, validated class tokens from trusted configuration and
  host-owned CSS. Default MVP output has no arbitrary inline styles, CSS URLs or
  required editor CSS. This deliberately bounds #650's class/style customization;
  inline CSS support would need a further reviewed policy and Angular proof.
- Known benign serialization normalization (quote/void-element spelling) is not
  a strict failure. Removing or changing disallowed markup/attributes/URLs is a
  diagnostic and strict failure; preview may return the sanitized remainder.
  Detect policy violations through parser/policy instrumentation, not raw string
  inequality. #682 must prove reliable classification with the selected sanitizer;
  inability to do so is a design blocker, not permission for silent transformations.

The accepted defaults are 1 MiB UTF-8 JSON input, 1,000 blocks, JSON nesting at most
32 levels, list nesting at most 16 levels, 100 KiB per content string, 2 MiB
accumulated formatted/sanitized output and 100 detailed diagnostics plus one
truncation diagnostic. Check bounds before callbacks and incrementally while
formatting. These tighten core's structural depth limit of 100 for rendering.
Use descriptor-aware bounded inspection for decoded data; do not stringify an
arbitrary object first and invoke getters/toJSON. Hosts can lower limits. Larger
limits need an explicit reviewed profile; no unlimited mode or unsafe trust flag.
Limits bound library work, not allocations or execution inside trusted callbacks.

Browser DOM parsing and actual execution/network controls must complement string
tests. #684 covers encoded URLs, malformed markup/nesting, namespaces, captions,
attributes, tune/custom/alias output and limit failures. Zero known npm advisories
is not a substitute. No complete security-audit or universal browser claim is made.

## Optional Angular package

Angular depends on the neutral renderer, not authoring packages. It has standalone
`EditorJsHtmlComponent` and `EditorJsHtmlDirective`, signal inputs, derived results
and OnPush component change detection. Both call the same headless function and
use normal Angular HTML binding/sanitization. Never call `bypassSecurityTrustHtml`,
install a second sanitizer engine or write DOM manually before hydration.

The component has a dedicated display container and no content projection into
the rendered region. The directive owns the children of its host, which must be
a normal block container such as div/article/section. Do not apply it to void,
table/select, paragraph/phrasing-only or interactive hosts, or combine it with
projected children, another innerHTML binding or another child-content owner.
It preserves unrelated host attributes/classes. Host-binding sanitizer behavior
must be proved in #686 on real CSR/SSR/hydration output before shipping.

Both expose the current render result and a result-change output so applications
can display diagnostics outside the owned region. Invalid new input clears old
HTML; empty input and preview have explicit states. Never keep stale successful
content while describing a failed replacement as current. No authoring, Forms,
editor construction, dynamic Angular component-per-block system, default error
markup with untrusted text, or application hydration provider installation.

Configuration resolution is fixed package defaults → nearest injected complete
configuration → explicit instance options. The nearest provider replaces an
ancestor's provider value; it does not concatenate registrations across requests
or injector levels. Scalar options override; nested registry/class/policy entries
are replaced as documented, not recursively merged. An explicit composition
helper can create a complete immutable registration set. Duplicate/override rules
remain identical to headless use; per-instance settings cannot weaken the hard
safety floor. The library snapshots incoming configuration and does not mutate it.

Provide a bounded `provideEditorJsHtml` provider factory usable in application,
route and element providers (ordinary provider array where compatible), plus a
typed configuration token. #686 must prove each advertised scope; do not assume
EnvironmentProviders work in component providers. Root configuration is immutable
and contains no request state. SSR request/instance result state remains local.
Input identity changes recompute; mutation of an already supplied object is not
an implicit reactive contract.

Angular may apply its own supported defense-in-depth sanitization during normal
binding. Choose the intersection of semantic markup/attributes supported by our
policy and Angular's binding; do not trust-brand output to retain stripped styles
or unsupported attributes. Compare actual headless and Angular DOM in #685–#687;
any meaningful fidelity loss is a failing contract or an explicit design revision,
not a reason to bypass Angular. Hosts own CSP/Trusted Types deployment and hydration
setup. See [Angular security guidance](https://angular.dev/best-practices/security#sanitization-and-security-contexts).

## Compatibility, package proof and delivery

These are **targets**, not support already established by this spike:

| Layer                                 | Exact initial proof targets                                                                                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neutral floor                         | Node 22.12.0; ES2022 declarations with TypeScript 6.0.3, NodeNext and Bundler, no DOM libs/ambient frameworks.                                                                   |
| Neutral current cells                 | Node 22.22.3, 24.15.0, 26.0.0; public ESM entry and bundled browser execution. Do not advertise native require/CJS unless an intentional export and consumer proof are supplied. |
| Angular minimum / reference / current | Angular 22.0.0 with Node 22.22.3; 22.1.4 with Node 24.15.0; 22.2.2 with Node 26.0.0; TypeScript 6.0.3. Re-evaluate before declaring a peer range.                                |
| Browser validation                    | Existing pinned Playwright 1.64.0 Chromium harness; record actual revision/binary for each cell. Other browsers require their own proof before claims.                           |

The research actually ran only Node 24.22.2/macOS/Chromium 156.0.8078.4 and source
contract checks. It does not certify these target cells or Angular SSR. Reuse
existing Angular 22 cells without upgrading authoring/runtime dependencies. Nest
is not a renderer dependency; broader Nest/HTTP/edge support is not inferred.

#682 includes safe first output, independent packed smoke, public exports/types
and full README. #683 extends profiles/recipes and corresponding tests/docs.
#684 proves the adversarial corpus before Angular integration. #685 and #686 each
include baseline real SSR/hydration for the component/directive. #687 installs
actual archives in independent consumers and broadens all claimed cells: CSR,
SSR, hydration warnings as failures, updates, failure recovery, request isolation,
production bundles and public-route requests with an authoring-leak negative control.

Meta0015 governs the resolved Nx graph: fresh dependency resolution/installation
and required-evidence completeness gates are uncached; deterministic tasks declare
source/policy/toolchain/archive/lock/environment inputs, prerequisites and restorable
outputs. Use isolated consumers/ports and real per-case atoms. Prove local miss/hit,
restoration/invalidation separately from authorized remote cache/DTE evidence.
Do not claim distributed scheduling because local tasks are split. Reuse existing
CI orchestration without duplicating a manual matrix. Hosted experiments, reruns,
monitoring and discretionary credit spending still require permission.

#688 hands renderer readiness to #75/#674–#680; #76 owns release-commit checks and
publication; #651 follows real npm availability. Each package starts independently
at 0.0.1 only after fresh npm/tag/release checks confirm it is unreleased. Use its
actual generated Nx project name for future package commit/release intent. This
research has no new Nx project and no version bump. No automatic merge, release,
consumer migration or upstream submission follows acceptance of this decision.

## Consequences and approval

We own a small semantic formatter and its strict policy, diagnostics and profiles;
the maintained dependency owns HTML parsing/sanitization machinery. Shared neutral
validation reuse is constrained by existing package dependency closure. Browser
size and parser instrumentation are explicit risks to verify, not hidden follow-up
work. Existing rendering integrations elsewhere are not migrated by this decision.

The full ADR preflight and accepted constraints are recorded in the research.
No accepted decision is superseded or conflicting. Governance proposals retain
their status; native Node HTTP candidate policy does not imply new renderer APIs.

Johan Vrolix explicitly accepted this ADR on 31 October 2026 and instructed that
PR #689 be marked ready for review. Acceptance covers the build/adopt choice and
sanitizer cost, strict/preview and missing-alt behavior, bounded class-only styling,
validation/dependency boundary, Angular configuration/host contract and proof plan.
The architecture decision gate is resolved. Implementation and compatibility proof
remain with #682–#688; #682 still waits for the predecessor to merge and an explicit
maintainer instruction to start the next slice.
