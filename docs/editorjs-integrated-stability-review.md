# Editor.js integrated stability review

Review for [#680](https://github.com/anarchitects/anarchitecture-community/issues/680),
6 November 2026, on integrated candidate
`f0a47cb579ae65028b4cc420d8dc56eb3aa11f27` (merged #708).
**Acceptance remains open:** the authorized CI inspection found the run still
in progress. This document records the completed artifact and coverage review;
it does not complete #75 or authorize #76 to start.

## Decisions, predecessors and evidence boundaries

All #681–#688 renderer technical slices, #674–#679 stability slices, #695 affected
selection and #696 protection reconciliation are closed and integrated. #679's
reopened follow-up is included through #707, followed by #708's protection review.
The package-level #688 review is supporting evidence, not whole-family acceptance.

The complete preflight for #696 read all 24 Meta and nine Community ADRs, including
proposed, historical and superseded records. Re-enumeration for this review found
the same canonical Meta tree `09d4fc898ad49c177e3e4bbd6b6be160896262cc`, unchanged
local ADRs and guides, and no additional ADR location or nested instructions.
The Modern Angular index, repository application and relevant architecture,
reactivity, Forms, SSR/build and testing guidance were reviewed. No accepted
decision conflict was found.

- Community0004 requires actual final packed documentation and complete recipes.
- Community0008 preserves the owned formatter, `sanitize-html@2.18.1`, strict and
  preview semantics, common custom-output safety and optional Angular boundary.
- Community0007/Meta0013 require independent version intent, exact package scopes
  and fresh distribution history before release. This contributor-only change
  uses `docs:` and changes no package version.
- Meta0015 requires accurate inputs, complete restorable outputs, safe scheduling
  and separate local, remote and distributed evidence. Policy does not authorize
  discretionary hosted work.
- Meta0016/0017 retain owner authority; this review neither merges nor publishes.
  Existing native Node/Fastify support and host persistence policy are unchanged.

The [coverage ledger](editorjs-stability-coverage.md) retains dated passing results
and the full critical-flow inventory. The mappings below reconcile those records
with the final workflow. They do not label historical executions as new results.

## Requirement and critical-flow mapping

The required check is `main`. It requires selection and all selected physical
workload jobs to succeed. Browser, upload-browser, SSR/hydration/isolation and
renderer preparation/atoms/collection are mandatory selected stages in
`workspace`; an earlier failure cannot be masked by a later successful stage.
The distinct neutral floor and authoring packed/DTE jobs remain separate.

| Requirement / observable flow                                                                                        | Concrete proof and completed owner                                                                                                                                                                                  | Required CI owner                                                                                               |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Parsing, malformed input, provenance, queue/read-only/disposal and stale completion                                  | Core parser/coordinator/controls suites and Angular component/loader suites; existing #66–#74 records, #675                                                                                                         | `workspace`; neutral `editorjs-core-runtime-baseline`; packed editor atoms                                      |
| Registry aliases, common tools, nested lists, quote attribution, literal Code and explicit custom/tune registrations | Core registry/resolver and tool suites; portable consumers; HTML profiles/extensions/conformance; #675 S1/S2 and #676 real saved display                                                                            | Neutral, `workspace`, authoring `portable`/`csr-editor`/`hydration-registry`; renderer headless/behavior/corpus |
| Save → detached storage → codec/service load → headless and both Angular displays (S1/S2)                            | `html/tests/persistence-consumer.mjs`, `html/tools/persistence.mjs`, `persistence/display-cases.ts`, archived core persistence/service recipes; #675/#676                                                           | Core/HTML tests, authoring CSR/portable atoms, renderer headless/behavior/corpus                                |
| Authored/missing/decorative alt, caption independence and invalid-display recovery (S3)                              | Image data/browser specs, shared renderer corpus, packed display editor/Forms/upload cases; #675/#676                                                                                                               | Neutral and `workspace`; authoring CSR upload/editor/Forms atoms; renderer corpus                               |
| Invalid/unsafe/stale/unauthorized data, migration failure, no write and no stale successful display (S4)             | Archived persistence/migration/service consumers; HTML security/adversarial fixtures and browser harness; Angular component/directive/provider suites; joined display cases                                         | Core/HTML/Angular tests, portable, packed CSR and renderer headless/behavior/corpus                             |
| Upload/save/load overlap, newer drafts, native Forms state, reset/disposal and owner fencing (S5)                    | Core upload-operation, upload-fetch adapter, Angular Forms/interop/upload-owner; `persistence/cases.ts`, `display-cases.ts`, hydration notebook cases; #676 and its deterministic acknowledgement-barrier follow-up | `workspace` browser/upload checks; authoring `interop`, `csr-*`, `hydration-*`, reference Nest upload atoms     |
| Scoped SSR/prerender, hydration parity, concurrent requests and cold public-route isolation (S6)                     | #677 stored-display fixture, `hydration/notebook-cases.ts`, `isolation/routes.spec.ts`, SSR validation; renderer browser-checks with actual authoring negative control                                              | `workspace` SSR/hydration/isolation; authoring SSR/hydration/isolation atoms; renderer build/behavior/isolation |
| Existing supported hosts and shipped examples                                                                        | #678 exact six headless/seven Angular recipe inventory and output checks; archived custom/persistence/upload recipes; existing private host inventory                                                               | Host build/typecheck, workspace browser/SSR, authoring packed atoms, renderer atoms and both collectors         |
| Safe renderer and Angular presentation contracts                                                                     | #682–#688 semantics, resource/URL/markup limits, custom callbacks, component/directive clearing/recovery and scoped providers; shared adversarial corpus                                                            | Neutral HTML checks, `workspace`, all 16 renderer atoms when selected                                           |
| Affected selection preserves security and compatibility                                                              | #695 plus reopened #679; ten contract tests including 29 actual graph scenarios, complete 89/16 atom reconciliation and failure controls                                                                            | Uncached `selection`; six admitted workload families; fail-closed `main`                                        |
| Cache restoration and scheduling                                                                                     | #679 local output/invalidation controls, authoring remote audit and actual worker evidence; renderer exception below                                                                                                | Authoring packed job, workspace renderer stages; separate evidence classes retained                             |
| Effective main protection                                                                                            | #696 merged read-back, ruleset 14374927, required `main` from GitHub Actions app 15368                                                                                                                              | Stable aggregate plus strict up-to-date protection                                                              |
| Exact integrated green CI                                                                                            | Pending completed results for run 42197426434 on this candidate                                                                                                                                                     | All selected mandatory jobs and `main`; no workload skip is expected for this full baseline                     |

The detailed [S1–S6 definitions](editorjs-stability-coverage.md#integrated-scenarios-to-close)
and subsequent #675–#678 execution records remain the source of scenario assertions
and bounded results. Packed-only notebook tests intentionally skip in the ordinary
workspace host; workspace success is not credited as their proof. Future basic,
Forms, SSR and Nest showcases remain #78, not nonexistent tested applications.

## Exact candidate CI and protection

The maintainer authorized one bounded read-only inspection of existing results and
artifacts. [Run 42197426434](https://github.com/anarchitects/anarchitecture-community/actions/runs/42197426434)
is the first `push` attempt for this exact candidate. At inspection, selection had
succeeded, ten workload jobs were in progress, `main` had no successful outcome,
and the run had no downloadable artifacts. The
[CI snapshot](evidence/editorjs-stability-680-ci.json) preserves those observations.
No monitoring, rerun, worker/capacity change or hosted experiment was started.

Selection's completed log records base `3c2ef2900c897a68c33e7eb298e599817c778d2c`,
head `f0a47cb579ae65028b4cc420d8dc56eb3aa11f27`, mode `all`, reason
`full-integration-baseline`, and all workload families selected. All ten selection
contract tests passed. Main pushes deliberately run the full baseline: these jobs
are not evidence that #695's PR affected selection regressed. A full run has twelve
expanded jobs including selection and aggregate. There are no expected unaffected
workload skips on this run.

**Open gate, owner: Community maintainers / #680.** Supply completed exact-candidate
job/check results and retained evidence, or authorize another bounded inspection
after completion. Confirm all selected jobs and `main` succeeded, the workspace
coordinator's required stages and 16-atom collector completed, and authoring's
89-atom collector, remote restoration audit and actual worker distribution passed.
Inspect matching snapshot/lock/archive identities before reusing hosted results.
If a required job failed, acceptance stays open for diagnosis and repair. The
in-progress snapshot proves neither success nor failure and is not final evidence.

The [protection review](main-branch-protection.md) and
[API read-back](evidence/main-protection-2026-11-06.json) remain applicable: #708
changes contributor evidence only, with no workflow/check changes after the
reviewed #707. Required `main` is bound to Actions 15368, strict/up-to-date is on,
PR/signature/history protections remain, and settings needed no mutation. The
existing `anarchitects-bot` bypass and its release-owner revisit condition remain
explicit; it is not authority to bypass missing stability gates. This is reuse of
the dated read-back, not a claim of another live settings audit.

## Final archive review and complete-family inventory

All ten packages were built through Nx with cloud access disabled, using local
Node 24.22.2, Yarn 4.18.0 and Nx 23.2.1 on macOS arm64. An initial Vite build stalled;
only its processes were stopped, and the remaining three projects passed serially
(eight tasks with prerequisites, five local hits). Local commands used the existing
`--skipSync` exception for unrelated Nest fixture TypeScript synchronization.
No package or test implementation was changed to obtain a pass.

After all build writers finished, final packs were inspected. Every packed
README, LICENSE and shipped Markdown recipe matches its owning source. Ordinary
default/import/types export targets exist, no dependency tree is bundled, and
workspace dependency ranges are resolved. Repository-only source conditions remain
workspace tooling entries, not consumer exports to enable in an installed package.
All ten authoring-path archive SHA-256 values exactly match `si679-cache`.
The [artifact inventory](evidence/editorjs-stability-680-artifacts.json) records
archive, payload-manifest, documentation, lock and predecessor result identities.

| Nx project / package suffix after `@anarchitects/` | Public surface and dependency boundary                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `editorjs-core`                                    | Neutral ESM root; no runtime dependencies/peers; archived custom, codec/migration and service recipes                                 |
| `editorjs-tool-paragraph`                          | Neutral root and `/browser`; core plus Paragraph 2.11.7; Editor.js 2.31.7 peer                                                        |
| `editorjs-tool-header`                             | Neutral root and `/browser`; core plus Header 2.8.9; Editor.js peer                                                                   |
| `editorjs-tool-list`                               | Neutral root and `/browser`; core plus List 2.0.9; Editor.js peer                                                                     |
| `editorjs-tool-quote`                              | Neutral root and `/browser`; core plus Quote 2.7.6; Editor.js peer                                                                    |
| `editorjs-tool-image`                              | Neutral root and `/browser`; core plus Image 2.10.3 and explicit alt authoring; Editor.js peer                                        |
| `editorjs-upload-fetch`                            | `/browser` only; core dependency; controlled transport and optional Nest upload recipe                                                |
| `editorjs-angular`                                 | APF root and optional `/forms`; core/tslib, Angular common/core and Editor.js peers; Forms peer optional                              |
| `editorjs-html`                                    | Neutral ESM root; core `^0.0.1` and exact `sanitize-html@2.18.1`, no framework or authoring runtime dependency                        |
| `editorjs-html-angular`                            | APF component/directive/providers; HTML/tslib dependencies and exact Angular core peer alternatives; no Forms or authoring dependency |

All ten manifests say `0.0.1`; this is not a fresh npm publication-history check.
Tool root neutrality does not mean their dependency installations omit Editor.js.
Headless has no advertised native CommonJS entry. Public declarations retain the
established neutral and Angular boundaries; no new ambient-type or API promise is
introduced. Licenses remain Apache-2.0 for these packages; external dependencies
retain their own licenses/notices, as reviewed in the package readiness records.

Renderer packaging was also reproduced under its actual selected Node versions.
Yarn-packed core and HTML match all seven retained renderer consumers exactly;
the Angular APF packed under Node 22.22.3, 24.15.0 and 26.0.0 matches all three
renderer consumers (`815efe3a…`). Packing the same APF under coordinator Node
24.22.2 produces `ed72a569…`, matching authoring proof; decompressed tar bytes and
all six files are identical. These distinct compressed identities are recorded,
not conflated. No changed consumer archive requires a new proof run in this review.

The retained seven renderer snapshots and locks were checked, plus all output
file hashes for 16 passing renderer records and nine reference-CSR authoring
records. The six headless and seven Angular recipe names were re-extracted from
the final READMEs with the existing strict extractors. This verifies retained
archive-specific evidence; it does not rerun those suites. Source fingerprints
changed with CI/cache work, so old preparations are not replayed as new candidate
snapshots. The prior current-Angular hydration timing failure followed by an
unchanged successful rerun remains recorded; this review does not classify it.

Compatibility remains the independent established matrix: neutral Node floor
22.12.0; headless Node 22.12.0, 22.22.3, 24.15.0 and 26.0.0; authoring and renderer
Angular/Node pairs 22.0.0/22.22.3, 22.1.4/24.15.0 and 22.2.2/26.0.0, with matched
Forms where used, TypeScript 6.0.3 and Editor.js 2.31.7 for authoring. Existing
Playwright 1.64.0/Chromium coverage does not imply Firefox, WebKit or broader OS
certification. The matrix files and their hashes are included in the evidence.

## Exceptions and honest consumer contracts

The maintainer explicitly accepted the **renderer G07 exception** in this
conversation on 6 November 2026. Renderer atoms have local restoration proof but
run on the coordinator; path-bearing execution identities and transport/relocation
remain unresolved for remote restoration and actual DTE. **Owner: Community
renderer/CI maintainers. Revisit before advertising renderer remote-cache or DTE
support**, with transport/relocation work and separately authorized proof. This
disposition permits a bounded stability acceptance once the other gates pass; it
does not authorize hosted work or waive exact-candidate green CI.

Authoring's historical 89 atoms on six workers and four-phase/31-file remote
restoration evidence remain separately scoped to the authorized predecessor run
in #679. They do not establish current-candidate worker/browser identity or
universal remote reuse. The current candidate evidence gate above remains open.

Intentional uncached boundaries remain accepted correctness constraints: fresh
dependency preparation, browser installation, long-lived servers and completeness
checks have external state or side effects; shared-directory/fixed-port workspace
SSR checks remain serial. Community CI maintainers revisit only after extracting
deterministic, isolated inputs/outputs/lifecycles. Selection remains uncached to
validate current Git history and the installed graph; revisit if measured overhead
justifies a safe boundary. No capacity or billing improvement is claimed.

G03a remains an unreproduced historical cold-route timing lead, owned by Community
maintainers. Reopen on recurrence with the exact cell/runtime/worker, trace and
idle-start/completion evidence. #677's passing local controls do not establish a
hosted cause or justify increasing timeouts/retries. Likewise, deterministic
persistence acknowledgement fixes must be judged by their assertions and current
results, not a new task's zero flakiness history.

Final packed guidance preserves the necessary consumer distinctions:

- Missing alt stays distinct from authored literal alt and deliberately decorative
  empty alt; captions, filenames and metadata never generate alt. Missing/blank
  alt can be structurally valid but fails strict rendering; preview omits it.
- Upload completion is not document persistence, `save()` does not wait for
  uploads, and abort is not rollback. Newer drafts and owner state need fencing.
- Hosts own durable storage, revision/authorization/migration, asset lifetime,
  publication policy, CSS/CSP and application accessibility. Nest persistence DI
  is not an HTTP endpoint; existing Fastify/native Node upload references remain
  the bounded backend examples.
- Custom tool/tune guards and renderer registrations are explicit. Code 2.9.4
  uses explicit save; no unsupported live-change guarantee is added. Custom HTML
  shares the safety boundary, but arbitrary callback JavaScript is trusted and
  not sandboxed. Strict success, structural validity and publication approval
  remain separate; preview is not approval.
- Existing native Forms contracts and direct-ngModel/reset limitations remain
  documented. No production-blog readiness or new adapter support is certified.

## Handoff to #75 and #76

#75 can mark its eight preceding deliverables complete and retain #680 as open.
G01–G06 and G08 have implementation/evidence records; G07's renderer limitation
now has explicit maintainer disposition, while its current-candidate hosted proof
and G09's green-CI gate await evidence. The archive review is complete within the
recorded identities. Do not close #75 on merge status or this document alone.

After #680/#75 acceptance and a separate instruction to start, #76 owns:

1. All ten named packages, including both renderers, with independent version
   intent, fresh npm/tag/release history and exact Nx scopes. Preserve initial
   `0.0.1` only where still unreleased.
2. Green required CI on the eventual exact release commit, appropriate affected
   admission/full-release evidence, and explicit owner authorization for any
   discretionary hosted inspection or rerun.
3. Final packed docs/licenses/notices, exports/declarations/dependencies and
   independently installed consumers after all release/check/build writers finish.
   Repeat proof invalidated by changed archive, dependency, policy or lock bytes;
   this record is not a substitute for changed release artifacts.
4. Release authority and the existing bot bypass boundary, then authorized
   publication and verification of the actual public package/version URLs.
5. Verified availability and evidence handed to #651. Parent #650's remaining
   post-release work does not block initial publication; #78 remains future demos.

No version bump, publication, automatic merge, #76 implementation or #78 work is
performed by this review.
