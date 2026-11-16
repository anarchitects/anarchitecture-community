# Nx Release changelog handoff correction — #773 / #742

Reviewed 16 November 2026. Owner: Johan, Community technical maintainer and SSR
capability owner. Johan requested implementation and an update to PR #773. GitHub
already reported #773 merged at `691f96b8dec8023c7074377090123361aa97597a`, so the
correction is delivered through a follow-up PR from that main commit.

## Result and boundaries

`nx.json` already selects independent project changelogs with `file: false` and
`createRelease: "github"`. The preparation wrapper contradicted that policy by
forcing `{projectRoot}/CHANGELOG.md`, then reading that entire file as the release
notes. That could also include entries for older versions.

The wrapper now delegates version calculation and changelog generation to the
installed Nx `ReleaseClient` with the repository's configured file policy and
renderer. It retains the returned project entry as `{ version, contents }` in
`.release/request.json` under `changelogs`. Content is copied unchanged, without
an additional parser, renderer or manually authored substitute. Missing, empty,
extra or wrong-version entries stop new preparation/freeze. The freeze consumes
the reviewed entry rather than a cumulative file or fallback project label.

Preparation still disables Git mutations and remote release creation through
Nx's phase arguments. Existing protected approval, exact-candidate CI, archive
identity, controller identity, numeric owner, publication and receipt controls
remain. For SSR, execution additionally checks the record's notes against the
integrated request. Previously frozen records keep their historical shape and
notes; pending requests without entries must be regenerated/reviewed before a
new freeze. No existing release evidence is rewritten.

File creation remains an explicit Nx configuration choice. Installed-Nx tests
prove both `file: false` and a configured `{projectRoot}/HISTORY.md` path, including
retention of older entries in that file while the API handoff contains only the
selected new entry. Repository settings were not changed to enable files.

## Current SSR request

Regenerated the existing request using Nx from the merged #773 source. Fresh
tag/release/npm history confirms the distributed 0.4.0 baseline and no 0.5.0
collision. Nx still derives **0.4.0 → 0.5.0**, with no dependent release or version
override. The request keeps `nest12` / `next`; no channel-policy change is made.
The unconfigured package CHANGELOG file is removed.

The returned notes are retained verbatim. They include the historical malformed
breaking-change body from #756, including its file-list text and old `0.3.x`
maintenance wording. This correction does not rewrite Git history or introduce
custom filtering to conceal it. The current package README states the accurate
0.4.0 maintenance version and migration contract. The earlier hand-edited notes
from #773 are not used by the corrected handoff. Review the retained Nx entry
alongside that README before release authorization.

## Architecture preflight

The preceding full preflight read all 25 Meta ADRs at
`4f0339d86f0ebfa073173ad307cb67c8d6042bdd` and all nine Community ADRs at `a50b009`,
including proposed and historical records. Re-enumeration and revision/diff
checks confirm both inventories and their contents remain unchanged on the
merged #773 base; Meta main was independently confirmed at the same revision.
Reassessed the expanded release-controller scope against those decisions and the
contribution, ownership, SDLC and release-execution/control guidance.

Meta0013/Community0007 retain Nx Conventional Commits as the version authority.
Meta0015 keeps fresh external checks and public mutations uncached; local tests
use no Nx Cloud. Meta0016–0019 and the accepted release-control design preserve
owner authority, review and immutable evidence. Community0004 keeps migration
guidance in the consumer README. SSR/Angular/framework-neutral package boundaries
and lifecycle policy do not change. Proposed governance records remain proposals.
No architectural amendment or dependency update is required.

## Verification and remaining work

- **49 release-policy tests pass**, including installed-Nx configuration/output
  behavior, divergent maintenance/feature history, no staging/commit/tag effects,
  exact-entry/version validation, SSR record/request matching and historical
  request handling. The first run exposed an old test fixture relying on the
  removed override; the fixture now declares its changelog policy explicitly.
- Regeneration confirms the existing version calculation and exact Nx output;
  no changelog file is recreated.
- A fresh local npm pack contains 36 files / 32,860 bytes and is byte-identical
  to the archive certified by #773's 21 consumer checks and two zero-finding
  runtime audits: SHA256
  `58f770cd0cfd1402cb1404d102366a32a374ea2ca017e3ffbf85b3edbffe40ef`.
  Archive inspection again verifies its manifest, README, license and exports.
  Runtime suites were not repeated for identical bytes and unchanged harnesses.

Local logs are `/private/tmp/773-nx-changelog-tests-final.log`,
`/private/tmp/773-nx-changelog-regeneration.log` and
`/private/tmp/773-nx-changelog-pack/`. Hosted final-candidate certification remains
required after integration. Johan retains normal PR CI inspection. The authorized
single conditional Nest 12 preparation is unconsumed; no hosted preparation,
release activation, publication, promotion or rerun occurs in this correction.
