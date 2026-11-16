# Editor.js Angular renderer 0.0.5 preparation

Date: 2026-11-16. Accountable owner: Johan Vrolix, Visual Composition capability
owner. Outcome: prepare `@anarchitects/editorjs-html-angular` for publication on
`latest`, following the accepted Angular 22.2.6 qualification in
[PR #776](https://github.com/anarchitects/anarchitecture-community/pull/776).

## Architecture and compatibility

All 25 Meta ADRs at `4f0339d86f0ebfa073173ad307cb67c8d6042bdd` and all nine
Community ADRs were enumerated and read, including proposed and historical
records. CONTRIBUTING, OWNERSHIP, SDLC, the release runbook, and the Modern Angular
application, testing/migration and SSR/build guides were reviewed.

Meta0013/Community0007 retain Nx Conventional Commits, independent versioning and
the accepted zero-major adjustment. Meta0015 keeps fresh history and publication
outside caching; Meta0016/0017 retain owner acceptance and release authority.
Community0004 requires the actual packaged README; Community0008 and the Modern
Angular ADR retain renderer safety, isolation and packed-consumer proof. No
architecture conflict or amendment is required. Proposed decisions retain their
status.

The existing exact Angular alternatives 22.0.0, 22.1.4 and 22.2.2 remain supported;
22.2.6 was added by #776. The public component/directive/provider APIs and runtime
implementation are unchanged. The reviewed compatibility minimum is patch. See
the [qualification record](nx24-angular226-776.md) for the four-cell evidence.

## Nx-generated candidate

The existing `@anarchitecture-community/source:prepare-release-version` target
ran locally with Nx Cloud disabled, selected only `editorjs-html-angular`, and
read compatibility evidence from outside the checkout. No version override or
first-release/stabilization mode was supplied.

Nx's `releaseVersion()` derived **0.0.4 → 0.0.5** from baseline
`5a4838eb91a0571771aa487a085d6d2b0dd272e5`, updated the manifest, and selected no
dependent version changes. Nx's `releaseChangelog()` generated the notes retained
unchanged in `.release/request.json`; `file: false` remains authoritative, so no
package CHANGELOG file is introduced. The new request replaces the completed SSR
request; it does not alter the retained immutable SSR release records.

Fresh public npm reads found renderer `latest` at 0.0.4 and no published 0.0.5.
The required headless 0.0.3 and core 0.0.1 dependencies are published. These dated
reads are evidence, not reusable release authorization.

## Local verification

- Renderer build, lint and type checks passed; all 35 unit tests passed.
- The existing uncached packed smoke passed with Angular/CLI 22.2.6,
  TypeScript 6.0.3, Node 24.22.3 and Chromium 156.0.8078.4.
- The isolated consumer installed packed artifacts with lifecycle scripts
  disabled, verified README/LICENSE and dependency boundaries, compiled seven
  README examples, built production browser/SSR output, and passed two SSR
  requests, hydration, provider-scope and security negative controls with no
  browser errors. This local Node patch supplements the existing exact matrix;
  it does not expand advertised support to untested combinations.
- Local renderer archive SHA-256:
  `3eced974111b6897126729651c4f2bf368996cceb79ca5b0ef750724007ad1cc`.
  Evidence is retained in `dist/test-results/editorjs-html-angular`. This local
  archive is not the hosted immutable publication candidate.

## Remaining handoff

The version PR requires owner review/merge and successful CI for the exact
integrated source. Hosted preparation must then produce the immutable archive
and release-record identity for owner review. Configure the renderer's npm trust
for `anarchitects/anarchitecture-community`, `publish-controller.yml`, environment
`community-publish`, close enough to publication to satisfy npm's initial-use
window. Review current settings before activation; preserve the separate
`community-release` and `community-publish` owner approvals.

Publication completion requires registry byte/channel verification, retained
receipts and evidence copies to encrypted USB **Anarchitects** and **Asustor
Lockerstor AS6604T**, with Johan as custodian. Restore paused controls after the
authorized execution. No hosted CI, trusted-publisher change, activation, tag,
GitHub Release or npm publication is performed by this local preparation.

## Hosted preparation follow-up — 16 November 2026

[PR #777](https://github.com/anarchitects/anarchitecture-community/pull/777)
merged as `698d6405ee52dfaaf4ed8adf90ecace7353c0200`. All ten jobs in exact-source
[CI 43902049823](https://github.com/anarchitects/anarchitecture-community/actions/runs/43902049823)
passed. The single authorized
[preparation 43910012170](https://github.com/anarchitects/anarchitecture-community/actions/runs/43910012170)
failed before package checks or artifact upload: the renderer's configured
`{projectRoot}/dist/package.json` was absent when Nx validated manifest roots
during its version dry run. Existing local generated output had hidden this
clean-runner failure. No tag, release or publication occurred.

The focused correction builds only the reviewed request's versioned projects
through Nx, after source admission and exact-source CI verification, before the
fresh Nx calculation. Unknown, empty and invalid release-line selections are
rejected before building. Nx still decides versions and dependent effects;
the existing fresh comparison, compatibility checks, package gates, final build,
archive inspection and consumer installation remain mandatory. The read-only
preview still disables the workspace-wide pre-version hook. The request, package
version, notes and dependencies are unchanged.

The complete Meta/Community ADR inventory above was re-read for this tooling
scope; Meta main remains `4f0339d86f0ebfa073173ad307cb67c8d6042bdd`. No new
architectural decision or release-control exception is needed.

The installed-Nx regression reproduces failure without generated manifests, then
builds through Nx and obtains the expected version without modifying source
manifests, the index, commits or tags, or running the configured pre-version hook.
A real local renderer run with its prior `dist` moved outside the checkout also
restored the build through Nx and passed fresh history/preview: 0.0.4 to 0.0.5,
no dependent version changes, and no existing public 0.0.5. These are local
checks; a successful hosted preparation remains required after review, merge and
fresh exact-source CI. The failed dispatch consumed its single-run authorization.

All 50 release-policy tests, release configuration validation, formatting,
diff checks and the proposed unscoped commit/PR message passed locally. Changes
are confined to preparation tooling, its regression tests and operational docs.
