# Five-tool packed consumer validation (#615)

## Scope and architecture review

This slice validates paragraph, header, list, quote and image together in private
consumers. It changes no package API, supported peer range, HTTP adapter or public
renderer. The existing single-tool cases remain in the same matrix.

Preflight enumerated and read all eight Community ADRs and all 18 Meta ADRs at
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`, including proposed and historical
records, and the applicable Modern Angular guides. Community was based on
`42c7ebe2118eacd8f9852819c5e470ebb7e0d62e` after #614 merged.

Applicable constraints are the accepted Modern Angular decisions on native Signal
Forms, exact compatibility, request-owned state and packed consumer evidence;
Community ADR 0004 on actual public package documentation; and Meta ADR 0015 on
cache inputs, restorable outputs and DTE. Community ADRs 0005/0006 and the Meta
HTTP/Nest decisions preserve the existing SSR runtime. Meta 0013 and Community
0007 require real Nx project scopes and independent package release policy.
Proposed governance records do not override accepted contracts. No conflict or
amendment is needed for these private fixtures.

## Consumer and delivery contract

`src/common/definitions.ts` supplies the same pure definitions/configuration to
an Angular-free consumer, Angular standalone editors and native `[formField]`
controls. Paragraph explicitly replaces Editor.js's built-in definition. Each
browser loader imports its packed browser entry; observation subclasses count
module evaluation separately from tool/editor instances. The public root imports
remain inert on the server. A deterministic local SVG and host uploader preserve
literal metadata without external services.

Fresh CSR preparation installs each tool archive in its own external directory,
with only its core dependency and exact Editor.js peer. It checks declared
upstream versions, public root exports and browser-entry resolution, and verifies
that Angular and the other four tool packages cannot resolve. Each install keeps
its own lock and evidence. The combined generic consumer then compiles/runs all
five; Angular preparation separately compiles the standalone consumer before
Forms is installed. No consumer resolves through workspace ancestors.

The combined browser cases edit/save all five blocks and call the public saved-
data validators. Image checks distinguish unset alt, authored literal text and
explicit decorative `alt=""`; keyboard authoring does not create extra blocks.
Caption and uploader metadata survive independently. A controlled fixture image
projection carries the authored attribute, including absence and empty text.
This is bounded accessibility evidence, not a general renderer, URL policy,
sanitizer or complete accessibility audit.

Standalone and native Forms holders are captured empty in real SSR HTML and
retained through hydration. Forms checks cover dirty/touched, reset, readonly and
disabled with the actual five tools. Two editors remain independent; failed and
pending lazy loads cannot revive disposed owners. A held image upload completes
after removal without reviving that editor or changing the survivor. Host work
already in progress is not promised to abort.

The server import guard covers every real upstream tool and fixture browser module.
Sequential and overlapping requests for `/tools` and `/tools/forms` retain their
own data/configuration and dispose their Angular owners. Production graph evidence
identifies upstream code and each packed browser entry. Cold public navigation
checks requests, execution, preload hints and embedded styles. Authoring is a
positive control; paragraph-only generic selection leaves the other four real
tools undelivered. The eager negative control imports all five. Re-entry creates
new owners while downloaded modules and injected styles remain cached. Explicit
host preloading remains capable of violating the delivery policy.

## Matrix and Nx evidence

The unchanged cells are Angular 22.0.0 / Node 22.22.3, Angular 22.1.4 / Node
24.15.0 and Angular 22.2.2 / Node 26.0.0, with TypeScript 6.0.3 and Editor.js
2.31.7. This is Chromium evidence on these exact cells, not a widened support range.
The installed upstream versions are paragraph 2.11.7, header 2.8.9, list 2.0.9,
quote 2.7.6 and image 2.10.3. All five Anarchitects packages and core are 0.0.1.
The tool packages' independent core minimum remains separate.

The new `hydration-common` file runs independently from synthetic registry
hydration and depends on the existing production/diagnostic/full builds. The
resolved graph has 69 cacheable atoms and six uncached preparations. No fresh
install enters DTE. Existing archive/source/configuration/lock fingerprints cover
the shared fixture and preparation changes; isolated roots, ports, output paths,
process cleanup and the uncached completeness gate remain in force.

Fresh preparation for run `tools-615-c` passed all six cells on macOS arm64,
with orchestration Node 24.22.1. All 15 independent installs passed. The six
preparations took 139 seconds wall time with three task slots; per-cell preparation
was 58–72 seconds. These are local observations, not hosted DTE timings.

Workspace typecheck, SSR typecheck and lint passed (the existing eight host and
48 e2e warnings remain). The seven harness contracts and all 12 workspace
production isolation cases passed. The final full matrix passed all 69 atoms with 0 cache hits in 453 seconds,
followed by all six uncached completeness gates. It includes 39 portable browser
cases, 27 combined hydration cases across the three hydration profiles and three
version cells, and 36 production isolation cases, alongside the retained CSR,
Forms interoperability, synthetic registry, lifecycle, SSR and README coverage.
The combined hydration atom took 16–23 seconds per cell, excluding its shared
build prerequisites; keeping this nine-case workload separate avoids adding it
to the synthetic registry atom.

Atom execution and uncached collection now independently verify the current
source fingerprint against the snapshot. A runtime-input check alone did not
prevent stale snapshot execution in the local invalidation experiment. The
harness regression exercises both guards, including a collector presented with
all-success phase records and a stale source fingerprint. Cache restoration and
invalidation evidence is recorded separately below.

### Local cache and invalidation

With the final execution/collection guards, the reference portable atom and
combined hydration atom plus its three build prerequisites ran cold again:
**5/5 misses, 67.80 s** including CLI startup. After moving all five output
directories away, replay took **2.82 s**, reported **5/5 local hits**, and restored
all **415 files byte-for-byte**. Representative hashes were
`4420514516865227792` (portable) and `9823011506060416932` (combined hydration).

Four independent temporary changes—shared fixture source, core dependency source,
`tsconfig.base.json`, and the independent-install helper—each returned exit 1 with
an explicit stale-snapshot failure. Original file bytes were restored after each
probe. Changing `NG_BUILD_MAX_WORKERS` to `1` caused a portable cache miss at hash
`5580780806122035188` (22.32 s); restoring the environment returned to the original
hash and a local hit (1.61 s).

A failed stale-snapshot output was also removed and replayed. Its diagnostic
record was restored byte-for-byte and the command retained exit 1. Nx's run
metadata labels that failed replay `cache-miss`, so it is not included in the
reported hit count. Restoring the source restored the passing output; all six
uncached collection gates passed again. The regression test independently proves
that stale snapshots fail collection even when every retained atom claims success.

### Hosted evidence and limits

The subsequent [#616 readiness review](editorjs-common-tools-release-readiness.md#hosted-dte-evidence)
records the completed #615 hosted run: all 69 atoms succeeded on three workers,
with zero cache hits and all six coordinator collection gates passing. It also
keeps the remaining remote-replay and performance-measurement limits explicit.

These measurements are local macOS arm64 observations. The #615 pull request's
CI checks and description retain the hosted Ubuntu/Nx Cloud run links and observed
worker/output-restoration outcomes. The existing workflow requests all 69 atoms,
keeps the six fresh preparations outside DTE, restores intermediate build/results
to the coordinator, and runs the uncached completeness gate before explicit
worker completion. This slice does not change worker provisioning or concurrency.

A successful distributed run and coordinator collection demonstrate the hosted
consumer result, not a same-attempt clean replay or remote failed-output recovery.
Those latter observations require a controlled hosted replay; repository CI
maintainers own that follow-up and should revisit it before claiming those forms
of remote reuse or a DTE performance/cost improvement. Local parallel execution,
local cache restoration and the historical worker-init fix are not substitutes.
