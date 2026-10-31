# Editor.js persistence and evolution design

This contributor design implements [#658](https://github.com/anarchitects/anarchitecture-community/issues/658),
the scope/policy slice of [#74](https://github.com/anarchitects/anarchitecture-community/issues/74).
Baseline: merged #73 at `0398b1cee713cf36231a0990d783fa9195ada25f`.
The decisions below guide the subsequent examples; they do not claim that those
examples, storage adapters or migration tests already exist.

## Decision and ownership

Use existing core contracts to demonstrate two equally valid persistence choices:
raw Editor.js JSON and an explicitly consumer-owned record with optional
provenance. Share mapping, version policy and validation between neutral services,
optional Nest composition and optional Angular authoring. No new public helper,
package, storage SDK or migration engine is justified by this inventory.

Applications own schema identity, migrations, storage revisions, credentials,
authorization, transactions, retention, rendering and adoption. Community owns
its portable package contracts and complete, bounded public recipes. Nothing in
this design makes a fictional record shape a Community or Bricks wire contract.

## Architecture review

The #74 planning and #658 review on 31 October 2026 enumerated and read all eight
Community records under `docs/adr` and all eighteen Meta records under `adr`,
including proposals and historical material. No other local ADR location or
nested agent instructions were found. The clean adjacent Meta checkout and all
eighteen ADR blob identities match the freshly fetched remote tree
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. Unchanged records read during the #74
planning review remain part of this review. Modern Angular index, repository
application, architecture, providers/routing, reactivity, Forms, SSR/builds and
testing/migration guidance were reviewed for the planned seams.

| Decision                                       | Application to this scope                                                                                                                                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Community0004                                  | Each implementation slice ships complete owning-package guidance; compiled archive examples must match public files. Contributor sequencing/evidence stays here.                                                  |
| Angular A01/A02/A03/A05/A07/A09/A10            | Shared logic stays neutral; Angular adapts it with explicit state/owner lifetime, optional native Forms, safe submission and packed browser/SSR proof. No framework upgrade.                                      |
| Meta0008/0009/0010/0011 and Community0005/0006 | Nest examples retain host security/schema responsibilities and existing HTTP choices. Native Node remains a candidate default; prior upload proof is not general SSR or API parity. No Nest 11 feature expansion. |
| Meta0012                                       | An illustrative DTO/service does not create a canonical shared public API. Any later shared wire-contract change requires its actual owner and compatibility review.                                              |
| Community0007/Meta0013                         | Independent package intent, exact Nx scopes and non-bumping development while unreleased; publication remains a separate gate.                                                                                    |
| Meta0015                                       | Reuse accurate Nx graphs and packed atoms; model new guide/fixture inputs, isolated outputs and genuine prerequisites. Fresh installs/completeness remain uncached.                                               |

Governance-specific accepted records retain their own scope; this work does not
expand their canonical models. Cooperative enrichment, hierarchy, Archi and
workspace-layering records remain proposed. Dependency-maintenance policy grants
no incidental update or automerge authority. No accepted-ADR conflict or exception
is identified. Repeat the full review before subsequent implementation and any
scope change; a discovered API or compatibility gap must be documented first.

## Existing API and evidence inventory

The [public root](../packages/editorjs/core/src/index.ts), owning
[README](../packages/editorjs/core/README.md), source signatures and existing
generated declarations were inspected. Generated declarations are an inventory
aid, not a new release build or a fresh consumer-validation result.

| Public contract                                                   | Existing behavior and proof                                                                                                                                                                                                                                                                                                                                                         | Remaining recipe work                                                                                                                         |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `OutputData`, `OutputBlockData`, `OutputBlockDataFor`, JSON types | [Contracts](../packages/editorjs/core/src/lib/output-data.ts), [type tests](../packages/editorjs/core/tests/output-data.spec.ts) and [isolated type consumer](../packages/editorjs/core/tests/fixtures/type-only-consumer.ts): optional metadata, opaque payloads, configured-name discriminated unions. Types do not prove JSON safety.                                            | Map application records without making a UI control or metadata envelope mandatory.                                                           |
| `parseOutputData`                                                 | JSON text or decoded input; first structural diagnostic, no partial success, detached JSON tree. [Implementation](../packages/editorjs/core/src/lib/parse-output-data.ts) and [tests](../packages/editorjs/core/tests/parse-output-data.spec.ts) cover malformed text, envelope checks and prototype-like keys.                                                                     | Read actual stored bytes, enforce host input bounds, expose useful non-content diagnostics.                                                   |
| `normalizeOutputData`                                             | Decoded input only; preserves supported unknown fields, tunes and HTML strings; omits only allowed undefined metadata. Same tests cover immutability, cycles, sparse arrays, accessors, hidden/symbol properties, depth and explicit symbol-key omission.                                                                                                                           | Normalize before serialization; explain semantic JSON equality rather than byte/canonical equality. No timestamp, ID or version fabrication.  |
| `validateOutputData`                                              | [Implementation](../packages/editorjs/core/src/lib/validate-output-data.ts) and [tests](../packages/editorjs/core/tests/validate-output-data.spec.ts): structural/ID checks before synchronous tool callbacks, exact configured-name lookup, frozen detached callback input, exception/async-result containment. Unknown tools allowed by default; explicit rejection is available. | Choose authoring policy, validate tune payloads separately, distinguish validation from safe rendering and authorization.                     |
| `parseContentWithProvenance`                                      | [Implementation](../packages/editorjs/core/src/lib/content-provenance.ts) and [tests](../packages/editorjs/core/tests/content-provenance.spec.ts): optional decoded sidecar, detached copies, distinct data/provenance error paths, unknown/future strings and extensions preserved. Raw `schema`/`toolVersions` fields are not interpreted as sidecar metadata.                    | Decide host compatibility, missing-version policy, explicit migrations and storage placement. No version comparison/migration exists in core. |

The [package suite](../packages/editorjs/core/tests/package.spec.ts) verifies
archived README/LICENSE/custom guide, root exports, absent runtime dependencies,
browser-global-free Node import, and actual README/neutral guide compilation under
NodeNext and Bundler with ES2022-only libraries and no DOM/Node ambient types.
The [custom-tool record](editorjs-custom-tools-validation.md) separates neutral,
Angular, Forms, SSR, hydration and hosted cache/DTE evidence. The
[Nest upload record](editorjs-nest-upload-validation.md) proves that earlier
bounded HTTP example only. These are existing tests and dated results, not proof
of the persistence journey planned here.

Missing today: a complete raw/envelope storage round trip, an explicit application
migration, storage acknowledgement/revision behavior, a shared persistence
service/Nest composition, and Angular persistence-failure/in-flight-edit examples.
These are recipe and host-policy gaps, not evidence for another parser or service
in core. Revisit a reusable helper only if an implementation demonstrates a gap
that cannot be composed through the existing public API.

## Bounded editorial example and formats

Use a fictional **Editorial Notebook**, unrelated to any deployed consumer. Reuse
#73's callout/marker/flag examples rather than authoring another browser tool.
Its illustrative schema identity is `example/editorial-notebook`; versions `1`
and `2` are opaque application labels with one explicit migration path. These
names and policies belong to copied application source, not package exports.

| Choice           | Planned mapping and observable result                                                                                                                                                                                                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw JSON         | Store only `OutputData`. A host selects the known collection/profile externally; no schema field is injected into the document. Read, validate, serialize, write and reload the same semantic JSON.                                                                                                                                                       |
| Consumer record  | A deliberately small example record has `id`, `revision`, `document` and optional `provenance`. The mapper extracts `document` and the decoded sidecar explicitly. Record fields are validated by the example; unknown record fields are rejected rather than silently dropped. This is one alternative, not an auto-detected wrapper around every input. |
| Optional sidecar | `ContentProvenance` may live with the record or separately in host storage. Omitted and empty metadata remain different. Raw document fields named `schema` or `toolVersions` retain their existing extension meaning.                                                                                                                                    |

#659 supplies a runnable local round trip with explicit storage ownership and a
failure-injectable implementation. A Node file adapter can demonstrate reload
across invocations; Node imports stay in the example adapter, outside core and
the reusable codec. It must state overwrite/durability limits and use disposable
example paths. #661 supplies the bounded in-process revision-aware repository;
it does not advertise multi-process transactions. #662 supplies a local example
port so the Angular quick start needs no missing backend. None is production
storage, offline synchronization or a public persistence API.

Preservation has two different boundaries. Storage/migration utilities preserve
all supported untouched JSON, including unknown document/block/data extensions.
An Editor.js tool can serialize only its known fields. Authoring therefore uses a
narrower explicit profile: reject opening/saving content whose fields or tunes
the selected tool cannot round-trip, retaining the original for host recovery.
Do not silently strip unknown fields to make a document editable. A future merge
policy could preserve additional fields, but it needs separate identity/conflict
proof; it is not assumed by this recipe.

## Version and migration policy

| Identity                           | Meaning and rule                                                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OutputData.version`               | Recorded Editor.js producer version. Preserve on parse/migration; a real editor save may report its actual version. Never use it as the application schema version or storage revision. |
| Provenance schema ID/version       | Select the explicit application policy/migration. Do not compare arbitrary labels as SemVer or infer from a package installation.                                                       |
| Configured tool name               | Persisted `blocks[*].type`, not necessarily an npm name. Renaming requires migration plus matching registrations/validators.                                                            |
| `toolVersions`                     | Optional versions keyed by configured names; provenance only. Missing versions are not invented; unknown versions are not certified compatible.                                         |
| Core/Angular/tool package versions | Package API/dependency compatibility; neither a content migration nor an application revision.                                                                                          |
| Storage revision                   | Opaque host precondition for writes. It is not `time`, a block ID, change-event sequence or package version.                                                                            |

The example's editing decisions are explicit:

| Input                                                                                       | Outcome                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Known schema `example/editorial-notebook`, version `2`                                      | Check current tool/data/tune/field profile, then permit editing and explicit save.                                                                                                                                                                                   |
| Same schema, version `1`                                                                    | Check legacy preconditions, migrate a detached candidate, validate the complete target, then expose it for explicit save. No write on read.                                                                                                                          |
| No schema metadata, including legacy raw JSON                                               | A caller must select a known raw collection/profile. The raw-current recipe uses the current profile without adding provenance. Without that selection, retain for inspection/export and refuse editing/writeback. Do not guess from payload shape.                  |
| Partial or malformed provenance                                                             | Structural failure; no migration, editor replacement or write.                                                                                                                                                                                                       |
| Different schema ID, unknown/future label, unsupported supplied tool/producer compatibility | Preserve structurally valid input for recovery; return unsupported for authoring. No stripping, downgrade or relabelling. The example's verified producer/tool allowlist is explicit; absent provenance uses the explicitly selected profile, not inferred versions. |

#660 demonstrates one forward migration: legacy configured block `aside` with
`message` and `tone` becomes `callout` with `text` and the same `tone`, reusing the
current callout implementation. Reject an existing target `text` field or a
conflicting provenance key instead of overwriting it. Preserve block identity,
ordering, untouched fields/tunes and unrelated metadata; validate source and
target rules separately. If an `aside` tool-version entry is supplied, its
supported mapping to `callout` must be explicit; absent entries stay absent.
Change schema provenance only after success. No generic callback registry,
reverse migration, automatic chain discovery or universal semver algorithm.

Current content is not migrated again on reload. Any failed transformation or
target check leaves the source and stored record unchanged. Backups, rollback,
mixed deployment versions, durable migration jobs and concurrent migration
writeback remain host concerns. A migrated in-memory candidate is not evidence
that a stored record has changed.

## Load, edit and save ownership

1. Load bounded untrusted bytes/values through the host. Select raw versus record
   mapping explicitly; validate record identity/revision independently.
2. Parse structure and optional provenance through core. Retain the original
   record for recovery; do not replace the editor with an empty document on error.
3. Apply the selected compatibility policy and any explicit migration to detached
   data. Validate source preconditions and target block/tune/authoring rules.
4. Activate the editor only with supported data. Unsupported content can be
   exported/inspected safely without evaluating browser tools; that is not a
   public HTML renderer. Enforce application authorization at the server boundary.
5. On explicit save, obtain the intended editor snapshot, detach and validate it,
   apply the same host policy and map to raw/record storage. Serialize only checked
   JSON; never serialize callbacks, services, DOM objects, Files or Forms trees.
6. Submit with the loaded storage revision where the host supports preconditions.
   The server repeats authoritative validation and authorization. An in-process
   compare-and-write is one bounded example, not distributed atomicity.
7. Acknowledge exactly the submitted snapshot/revision. Reset native Forms only
   if that snapshot still represents the displayed draft; otherwise update the
   known storage revision while preserving newer local edits and dirty state.

The example allows one in-flight write per owner and rejects duplicate submits
as busy. It retains edits made while saving. An owner/load generation fences late
results after a new document loads or the owner is destroyed. A stale-write
conflict preserves the draft and requires explicit reload/reconciliation, not
blind overwrite or automatic retry. A timeout after a possible remote commit is
an unknown outcome: cancellation does not roll back storage. Recovery requires
host read/reconciliation or a separately proven idempotency policy.

| Failure boundary                                          | Required outcome                                                                                                 |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Read/parse/provenance/version/migration/tool/tune failure | No write or destructive editor replacement; retain source/draft and a bounded diagnostic.                        |
| Serialization failure                                     | No storage invocation or success state; retain submitted and current drafts.                                     |
| Precondition conflict                                     | No overwrite of newer stored content; surface conflict separately from validation.                               |
| Storage rejection or unknown completion                   | No false acknowledgement or Forms reset; preserve values and distinguish retryable policy from assumed rollback. |
| Late success for an old owner/load                        | No update of the new editor or form; the host may still need to reconcile a committed write.                     |

Diagnostic codes/paths should identify the boundary without echoing document
content, credentials or arbitrary exceptions. Tool validators can return their
own messages; the host is responsible for making them safe to expose.

Retain #71 caption versus missing/authored/decorative alt without inference or
automatic conversion. Retain #72 upload status, retry/cancellation and Blob/File
ownership: upload success does not acknowledge a document write. Retain #73's
separate tune checks and Code's explicit-save limitation for silent Tab edits.
Server authorization, public rendering, URL policy and blog publication remain
independent from schema validation. No generic XSS or accessibility guarantee is
introduced by successful persistence.

## Compatibility and evidence plan

The following are existing reference cells to reuse, not newly verified #74
features or broader support promises:

| Boundary                       | Baseline and required future evidence                                                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neutral package                | Node minimum 22.12.0; ESM and ES2022-only root declarations under NodeNext/Bundler, TypeScript 6.0.3. Actual packed recipe executes without Angular, Forms, Nest, Nx or browser globals. Node file-adapter ambient types stay separate.                                               |
| Browser/Angular/optional Forms | Angular 22.0.0 / Node 22.22.3, 22.1.4 / 24.15.0, 22.2.2 / 26.0.0; Editor.js 2.31.7, TypeScript 6.0.3. Actual archived shared sources compile with Forms absent/present; visible load/save/failure/newer-edit behavior is exercised in Chromium.                                       |
| Custom/third-party regression  | Reuse callout/marker/flag and existing Code 2.9.4 proof. Code's recipe remains Bundler-only; persistence does not establish NodeNext/raw Node support for its browser package or certify arbitrary tools.                                                                             |
| Optional Nest                  | Start with Nest 12.3.2 and Node 24.15.0; reuse existing isolated installations. #661 can prove DTO/service composition without inventing an HTTP API. Any newly advertised HTTP path needs actual selected-adapter proof; existing Fastify/native Node upload cells remain unchanged. |
| SSR/hydration                  | Shared codec has no browser evaluation; browser storage/editor work starts only after activation. Request state, late results and pre-hydration click/Enter need scoped proof wherever the new Angular recipe participates. Do not infer these from compilation.                      |

| Slice | Deliverable and evidence                                                                                                                                                     |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #658  | This inventory, explicit policy and scope review; documentation checks. No new runtime behavior or compatibility claim.                                                      |
| #659  | Shipped neutral raw/record recipes; actual stored round trips, unknown-data preservation, input immutability, malformed/non-JSON and storage-failure cases.                  |
| #660  | Actual migration fixtures: legacy/current/missing/future outcomes, target collision, tune/provenance preservation, failure/no write and repeat-current no-op.                |
| #661  | Shared service plus optional Nest boundary: valid save/load, invalid/no write, stale revision conflict and storage failure; no duplicated policy implementation.             |
| #662  | Complete standalone/optional Forms paths: same shared logic, load/save/reload, pending/error distinctions, late acknowledgement/new edits, reset and owner disposal.         |
| #663  | Actual archive extraction/compilation/execution across applicable cells, package boundary/import checks, isolated outputs and cache/invalidation evidence for changed tasks. |
| #664  | Complete journey review, final archives/compatibility/evidence, independent release intent and epic acceptance tracking.                                                     |

Each implementation ships its owning README/guide changes and meaningful tests;
the last slices consolidate evidence rather than defer those obligations.
Planned public recipes belong in the core package and optional Angular package;
thin Nest composition can accompany the neutral service guide. Packaging and
example extraction must include newly shipped files when implemented. Neither
the source design nor a copied test fixture substitutes for the archived example.

## Nx, release and validation boundaries

Resolved `editorjs-core` has 28 targets; `editorjs-angular-e2e` has 105. Core
build/test/typecheck/lint are cacheable with source/dependency/config/lockfile,
runtime/platform and relevant environment inputs; tests depend on build. The
existing packed harness has six fresh preparations, 89 validation atoms and six
completeness collections. Those counts describe the baseline, not a required
target count for #74. Prefer extending suitable existing atoms over one target
per new assertion. A new independently useful phase must model its prerequisites
and own restorable output directory/resources.

New archived guides must participate in packing, compilation and snapshot
fingerprints. Keep registry resolution, fresh installs and completeness checks
uncached. Changed harness behavior requires representative miss/hit, clean
restoration, relevant source/dependency/config/environment invalidation and
failure propagation evidence. Local cache results do not prove remote reuse or
DTE; reuse unchanged #73 evidence explicitly and record new evidence/exclusions
for changed tasks. No capacity change, CI monitoring or optional hosted experiment
is authorized by this design. Maintainers own remaining cost/failure experiments
and any revisit after material workload changes.

On 31 October 2026, fresh npm lookups returned 404 for core and Angular, remote
tags had no Editor.js release, and all 102 GitHub Releases had no Editor.js
distribution. Both package manifests remain 0.0.1. The design commit uses
`init(editorjs-core)`; no package artifact, dependency, target or version changes.
Later slices must recheck actual history independently. #76 owns publication:
all configured checks must pass on the eventual release commit, then its exact
final archives must be inspected after checks/build completion.

For this documentation-only slice, verify formatting, local links, source/API
references and diff whitespace. Existing runtime/packed tests are inventoried,
not rerun or claimed newly green. No build/pack writer or hosted run is needed.
The next slice remains #659, started only on explicit maintainer instruction
after this PR merges. #75/#78 broader demos/testing, #76 publication, production
data migration, consumer adoption and public rendering remain outside #658.

## SI-74.2 implementation record — 31 October 2026

#659 starts from merged #658 (`1d62345`). Before code changes, all eight local
ADRs and all eighteen Meta ADRs were enumerated and read, including proposed,
historical and superseded records. The clean Meta checkout matched the freshly
fetched remote tree at `823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. The Modern
Angular index, repository application, architecture and testing guides were also
reviewed for neutral reuse and package evidence. No accepted-decision conflict
or exception was identified; proposed records do not change existing defaults.

Community0004 requires the shipped install-to-result recipe and actual archive
proof. A02/A10 keep it framework-neutral and test public imports. Meta0012 and
Community0005/0006 preserve contract/HTTP ownership: no DTO, HTTP adapter, Angular
or Forms implementation changes here. Community0007/Meta0013 retain independent
initial version 0.0.1: fresh npm lookup returned 404 for core, remote Editor.js
tags were absent, and all 102 GitHub Releases contained no Editor.js release.
Exact Nx scopes are `editorjs-core` and `editorjs-angular-e2e`; this slice uses
non-bumping `init` intent and leaves package exports/dependencies unchanged.

The shipped [core persistence guide](../packages/editorjs/core/persistence.md)
contains the shared codec, a bounded single-slot in-memory store, and a runnable
raw/record demonstration. The store is intentionally non-durable and owns no
external resources. Record metadata is explicitly mapped, never inferred from
raw extension fields. Existing core APIs reject unsupported data before
serialization; caller input is detached, optional provenance remains distinct,
and rejected writes do not acknowledge success. Revision comparison and
migrations remain later slices. No reusable core API gap was found.

The existing package test extracts the three files from the actual npm archive,
compiles both NodeNext and Bundler variants with ES2022-only declarations, runs
the printed demonstration, then executes ten behavioral consumer checks per
variant. These cover preservation/detachment, optional/opaque provenance,
explicit format rejection, non-JSON/accessor rejection, validation policy,
bounds, read failures, write recovery, submitted-snapshot acknowledgement and
serialization failure. The consumer has no Angular, Forms, Nest, Nx or installed
Editor.js; browser-global access throws. Only assertions live in the test
fixture; the implementation comes from the archived guide.

For Meta0015, the existing package atom now hashes the same source, dependency,
configuration, runtime/platform, `NODE_OPTIONS` and `CI` inputs as core's full
test target. Its build prerequisite and isolated inferred report directory are
retained. An explicit empty `options.env` avoids Nx 23.2.1's inferred undefined
environment on a fresh graph, which otherwise fails executor schema validation;
it supplies no environment overrides. The new guide also participates in the
packed snapshot source fingerprint. No new target, fresh-install cache policy,
agent capacity or hosted experiment is introduced.

Local validation used Node 24.22.2 on macOS arm64, TypeScript 6.0.3 and Nx
23.2.1, with Nx Cloud disabled. Core build, lint, typecheck and all 271 tests in
11 files passed, including the six package tests and their twenty nested
persistence checks. The seven packed-harness tests passed with loopback access;
the e2e lint target had zero errors and 72 existing warnings. The unchanged
browser/Angular/Nest compatibility matrix was not rerun or newly certified.

The package atom had a successful miss followed by a 2/2 local hit (including
build), and removing its build directory restored identical output bytes from
cache. Temporary changes to `tsconfig.base.json`, `yarn.lock` and `NODE_OPTIONS`
each caused 0/2 hits. A guide-only fingerprint probe changed the snapshot hash
and restored it exactly. An intentionally broken archived demonstration failed
both new full-test cases; restoring the guide returned all 271 tests to green
and the package atom to 2/2 hits. A separate atom failure probe stalled during
its build and was stopped; it is not claimed as completed evidence. Temporary
probes were restored. These are local checks, not remote-cache or hosted DTE
proof; the existing distributed target topology is unchanged.

After final checks, the core archive was packed and inspected: README, license
and both guides match source; JavaScript/declarations are present; source,
tests and build-info files are absent. No runtime dependencies, extra exports or
version change were introduced. The PR records the inspected archive digest.
#660 remains unstarted pending explicit maintainer instruction after merge;
#76 retains final release-commit validation and publication.

## SI-74.3 implementation record — 31 October 2026

#660 starts from merged #659 at `8cba4d9`. Before code changes, all eight local
ADRs and eighteen Meta ADRs were enumerated and read again, including proposals
and historical/superseded sections. The clean Meta checkout matches the fresh
remote tree `823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. No other local ADR
location or nested agent instructions were found. Modern Angular index,
repository application, architecture and testing/migration guides were reviewed
for the neutral package boundary and archive evidence.

Community0004 requires complete shipped instructions and tests of the actual
archive. A02/A10 preserve public imports and framework neutrality; Meta0012 and
Community0005/0006 leave canonical HTTP contracts and framework defaults alone.
No accepted-policy conflict or exception was found. Proposed governance records
remain proposals. No new runtime API, dependency, schema authority or generic
migration framework is introduced.

The existing persistence guide now ships `evolution.ts`, explicit source/target
fixtures and `migrate.mjs`, reusing its codec and memory store. Migration only
accepts the documented schema path and configured names, preserves supported
untouched JSON, rejects collisions and unsupported supplied versions, validates
the full target before changing provenance, and performs no write. A separate
editing gate rejects archival extensions the selected tools might discard.
The raw-current path requires an explicit collection profile. No implicit
version inference, reverse migration, revision comparison or bulk writeback is
implemented; deployment, backups and concurrency remain host responsibilities.

The existing package atom extracts all six public files from the archive and
compiles the four TypeScript files under NodeNext and Bundler with ES2022-only
types. Both demonstrations run, followed by the existing ten persistence checks
and thirteen new migration checks in each resolution mode. The migration checks
exercise explicit destination equality, frozen-source immutability, preservation,
current-content no-op, absent/future/exact-version policies, collisions, separate
source/target/tune validation, size limits, unsupported editor fields,
prototype-like keys and failed writes. Only assertions reside in test fixtures.

Meta0015 review confirms the same 28 resolved core targets. No target or cache
configuration changes are needed: `default` includes the guide and assertion
fixture, source/dependency/configuration/runtime/environment inputs remain
explicit, the package atom depends on build, and the existing packed snapshot
fingerprint already includes this guide. Fresh installations/completeness remain
uncached. Reuse #659's configuration/dependency/environment invalidation and
failure-propagation evidence; this slice verifies changed-source execution and
local cache reuse/restoration. No new remote reuse, DTE or browser-matrix claim.

Community0007/Meta0013 release review found npm core still returns 404, no remote
Editor.js release tags, and no Editor.js distribution among all 102 GitHub
Releases. The exact project scope is `editorjs-core`, retaining non-bumping
`init` intent and version 0.0.1. #76 retains publication and release-commit gates.

Validation on Node 24.22.2/macOS arm64, TypeScript 6.0.3 and Nx 23.2.1 used
`NX_NO_CLOUD=true`. All 271 core tests in eleven files passed; the six package
tests include 26 new nested migration checks and 20 existing nested persistence
checks. Build, typecheck and lint passed (one existing unused-variable warning).
The package atom executed successfully after the source change, then produced
a 2/2 local cache hit with its build directory removed; all restored build bytes
matched. One earlier local Vite build stalled and was stopped; final checks
passed after retry. No hosted monitoring or optional credit-consuming run was
started, and unchanged Angular/Nest/browser compatibility cells were not rerun.

The final 38-file core archive was packed after checks and inspected: README,
license and both guides match source; JavaScript/declarations are present;
source, test fixtures and build-info files are absent. The PR records its
SHA-256. #661 remains unstarted pending explicit maintainer instruction after
merge; no publication or production data migration is performed by this slice.

## SI-74.4 implementation record — 31 October 2026

#661 starts from merged #660 at `9543bd8`. The eight local ADRs and eighteen
Meta ADRs were re-enumerated before code changes. The unchanged full records
read during the preceding slice remain part of this review: local ADRs and
Modern Angular guides have no intervening changes, and the clean adjacent Meta
checkout still matches the freshly fetched remote tree
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`. No additional ADR directory or nested
agent instructions were found. Modern Angular index, repository application,
architecture and testing/migration guidance apply to neutral reuse; the existing
Nest upload validation record supplies the reference installation and isolation
constraints. The official Nest standalone-context and factory-provider guidance
was checked for the new composition.

Community0004 requires a complete shipped guide and execution of its actual
archived sources. A02/A10 preserve framework-neutral public imports and testing.
Meta0008/0009/0010 and Community0005/0006 retain Nest 12 feature direction and
existing HTTP defaults. Meta0012 keeps canonical contracts with their owner:
this illustrative DTO has no HTTP route or new shared schema authority.
Community0007/Meta0013 require exact Nx scopes and independent release intent;
Meta0015 requires fresh uncached installations, immutable packed inputs and
isolated/restorable atom reports. No accepted-decision conflict or exception was
identified; proposed and historical records do not override accepted decisions.

The shipped [service guide](../packages/editorjs/core/service.md) copies the
existing codec and evolution policy unchanged. Its neutral service snapshots
and validates unknown input before asynchronous authorization, then calls a
trusted repository port. Load/save return bounded structured results; errors do
not echo content, credentials or arbitrary exception messages. Legacy reads
prepare an editable candidate without writeback. The eight-record in-memory
repository assigns revisions and performs a synchronous compare-and-write;
stale writes preserve newer bytes. It is explicitly non-durable and makes no
multi-process or database atomicity claim. Production adapters retain server
authorization, transactional concurrency, credentials and unknown-outcome
reconciliation responsibilities.

The optional Nest 12.3.2 composition uses a factory provider and a thin
unknown-DTO boundary with the same neutral service. Its standalone application
context has no HTTP listener, request pipes or guards; it closes in `finally`.
There is no core runtime/dependency/export change, new package, schema framework
requirement, default-adapter change or production storage implementation.

The existing core package test extracts the actual archived service source,
compiles it under both NodeNext and Bundler with ES2022-only types, and executes
the public demonstration plus eleven new behavioral checks per mode. They cover
detached round trips, unknown DTO rejection, invalid/unsupported/migration-failed
no-write behavior, concurrent stale writes, failure recovery, capacity,
authorization, pending-request snapshot capture, explicit migration, corrupt
reads and independent repository state. The neutral consumer has no Angular,
Forms, Nest, Nx or installed Editor.js, and browser-global access throws.

The existing CSR reference preparation installs the actual core archive in its
Nest native-Node host and extracts both guides byte-for-byte. The existing
`packed-csr-angular22-reference-nest-upload-node` atom now also compiles and runs
the shipped standalone composition; its prior upload checks remain intact.
The new guide and extraction helper participate in the packed source fingerprint.
No target or capacity change is needed: the resolved graph remains 28 core and
105 e2e targets, including 89 packed validation atoms. Fresh installations and
completeness checks remain uncached. Validation uses local Nx with Cloud disabled;
it makes no new hosted DTE or remote-cache claim.

Fresh release-history checks found npm core still returns 404, no remote
Editor.js release tags, and no Editor.js distribution among all 102 GitHub
Releases. Affected exact project names are `editorjs-core` and
`editorjs-angular-e2e`. Core retains independent version 0.0.1 and non-bumping
`init` intent. #76 retains final release-commit checks and publication authority.

Local validation used Node 24.22.2/macOS arm64, TypeScript 6.0.3 and Nx 23.2.1
with `NX_NO_CLOUD=true`. Core's 271 tests passed, including 22 new nested
service checks and the 46 existing persistence/migration checks. Core and e2e
lint/typecheck passed, as did all seven packed-harness tests. Fresh CSR reference
preparation completed, then the native-Node atom passed its existing sixteen
upload scenario groups and the new standalone Nest service assertions. The
new report records Nest common/core 12.3.2, Node 24.15.0, TypeScript 6.0.3 and
core 0.0.1, with successful load/save, invalid/stale/forbidden and failed-write
preservation outcomes. No broader Nest/Angular/SSR compatibility is claimed.

The native-Node atom executed on a cache miss, then replayed from local cache;
all fourteen report files were restored byte-for-byte after removing its output
directory. One sandboxed replay missed the cache and failed on loopback `EPERM`;
the replay with loopback permission hit the original successful cache entry.
Temporary changes to the new guide and extraction helper each changed the source
fingerprint and caused Nx to reject the stale snapshot before consumer validation. Both
files and the fingerprint were restored exactly. Existing #659 configuration,
dependency and environment invalidation evidence is reused because those input
contracts are unchanged; the harness checks retain graph, isolation and failure
propagation coverage. Local evidence is under
`dist/editorjs-packed-inputs/si661-local` and
`dist/editorjs-packed-results/si661-local`, not committed package contents.
Hosted DTE/cost experiments and CI monitoring remain maintainer-owned and require
explicit permission; revisit on a material workload/topology change.

After all checks/build writers completed, the final 39-file core archive was
packed and inspected. README, license and all three guides match source;
JavaScript/declarations are present, and source/tests/build-info files are absent.
Its SHA-256 is `2a594cc4a37a3cc7797b79edc6866a87449c570ee8868df9bce5327b6aab7d7a`,
identical to the core archive exercised by the Nest reference atom. Formatting
and diff-whitespace checks passed. #662 remains unstarted pending explicit
maintainer instruction after merge; no publication, CI monitoring or optional
hosted run was started.
