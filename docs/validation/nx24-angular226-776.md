# PR #776: Nx 24 and Angular 22.2.6 qualification

Date: 2026-11-16. Accountable owner: Johan Vrolix. Scope: repair the failed
workspace checks on `chore/nx-migrate-24-0-6` and qualify Angular 22.2.6 as an
additional Editor.js consumer baseline, as explicitly accepted by the owner.

## Decisions and compatibility

The preflight reviewed all 25 Meta ADRs and all nine Community ADRs, including
proposed and historical records, plus CONTRIBUTING, OWNERSHIP, SDLC and the
Modern Angular application, testing, SSR/build and Forms guides. Applicable
accepted constraints are Meta0013/Community0007 (Nx release authority), Meta0014
(human review of dependency changes), Meta0015 (complete task inputs, outputs and
evidence), Community0008 (renderer safety and isolation), and the Modern Angular
compatibility and migration gates. No ADR amendment or architecture conflict is
required. Proposed decisions do not replace accepted policy.

The failing [CI run](https://github.com/anarchitects/anarchitecture-community/actions/runs/43871290933)
had five failed workspace tasks. The separate packed DTE and compatibility jobs
passed. Nx Cloud declined to generate a fix for the workspace execution because
another execution on the branch was newer.

- Renderer lint correctly rejected workspace Angular 22.2.6 outside its exact
  published peer alternatives. Add only 22.2.6, retaining 22.0.0, 22.1.4 and 22.2.2.
- Six Forms assertions expected immediate legacy-model publication. Angular
  22.2.6 now honors `updateOn` for direct legacy bindings to custom controls.
  Verify pending values and pristine state, then publication on touch/submit;
  retain immediate-publication assertions for the older baselines and compatForm.
  No package runtime implementation or custom Forms bridge changes.
- Three SSR/browser tasks expected combined `stats.json`. Reuse the packed
  harness's split browser/server metadata handling in workspace validation.
  Keep both original files, reject missing/ambiguous evidence, and atomically
  write the combined view. All import isolation, lazy graph and security
  assertions remain enabled.

The authoring matrix gains `angular22-patched` and the renderer matrix gains
`angular-patched`, both Angular 22.2.6 / Node 24.15.0 / TypeScript 6.0.3. Existing
cells remain required. CI preparation covers both CSR and SSR; the graph guards
require all 118 authoring and 20 renderer validation tasks, their dependencies
and uncached completeness gates. This adds 29 authoring and four renderer tasks
plus clean-install preparation to normal CI.

## Validation

| Local validation                                                | Result                                                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Authoring unit suite                                            | 196 passed, including 40 Forms interop cases                                        |
| Renderer unit suite                                             | 35 passed                                                                           |
| Authoring/renderer lint and type checks; e2e fixture type check | Passed                                                                              |
| Workspace SSR                                                   | HTTP, deterministic output, prerender, escaped state, isolation and teardown passed |
| Workspace hydration / isolation                                 | 222 / 13 passed; 15 / 2 existing fixture-specific skips                             |
| Packed and renderer harnesses                                   | 10 / 6 passed                                                                       |
| CI selection and graph contracts                                | 10 passed; all new preparation tasks required                                       |
| Original 22.0.0 / 22.1.4 / 22.2.2 packed Forms suites           | 40 passed per version (120 total)                                                   |
| New 22.2.6 authoring CSR cell                                   | All seven tasks passed; completeness and artifact integrity verified                |
| New 22.2.6 authoring SSR cell                                   | All 22 tasks passed; completeness and artifact integrity verified                   |
| New 22.2.6 renderer cell                                        | Build, behavior, security corpus and isolation passed; artifact integrity verified  |
| Formatting, diff whitespace and prospective PR admission        | Passed, including all 19 required package scopes                                    |

The new authoring CSR evidence is retained under
`dist/editorjs-packed-results/067c5233-28d5-4f29-81fc-fb90a8459313/csr/angular22-patched`.
Verified SSR evidence is under
`dist/editorjs-packed-results/0daca809-3b38-4878-82d9-77a3dc70ce1e/ssr/angular22-patched`.
Renderer evidence is under
`dist/editorjs-renderer-results/pr776-angular226/angular-patched`; original-version
Forms evidence is under `dist/editorjs-packed-results/pr776-legacy-interop/csr`.

The local convenience wrapper reported a stale execution environment at CSR and SSR
collection: it passed empty `NODE_OPTIONS`, while Nx task records had it unset.
Running the existing collector with the recorded task environment passed all
integrity checks. No identity assertion was disabled and no evidence record was
edited. Hosted collection runs independently of that local convenience wrapper.
Local loopback/browser checks required execution outside the filesystem sandbox.

Hosted CI, remote cache restoration and DTE for this correction have not run.
Dependency review and merge remain with the owner; this change does not authorize
publication or alter release activation.
