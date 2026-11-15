# Nest SSR release lines and maintenance decision — #737

Status: **Accepted by Johan**, 15 November 2026 (Europe/Brussels).
Owner: Johan, SSR capability owner. This is an accepted policy decision, not a supported
version announcement, version preparation, release authorization or activation.

## Decision

Keep one `@anarchitects/nest-angular-ssr` package with separate version lines:

| Line              | Purpose                                                                                    | Source and channel after cutover                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `0.3.x`           | Nest 11 bug/security fixes only; preserve existing public APIs and Angular 21/22 contracts | Protected `maintenance/nest-angular-ssr-0.3` source branch; `nest11` npm channel                                     |
| `0.4.x` initially | Nest 12 feature development and verified compatibility                                     | `main`; publish the selected stable candidate to `next`, then explicitly promote the same verified bytes to `latest` |

The initial Nest 12 transition is breaking because it excludes Nest 11 and the
initial Angular 21 combinations, even if exported function names remain unchanged.
Under [ADR0007](../adr/0007-package-initial-release-and-nx-versioning.md), a breaking
change on `0.x` advances the minor. From the observed `0.3.2` baseline, `0.4.0` is
the illustrative first feature-line version; Nx Conventional Commits and fresh
history must calculate the actual candidate. This does not reserve or publish it.
Later breaking changes can advance that line again; `0.4.x` is not a permanent
promise that every future feature will be non-breaking. No `1.x` decision is made.

Do not widen one manifest to Nest `11 || 12` now. There is no dual-major packed
proof, Nest 12 changes module loading and lifecycle behavior, and new features
must not silently reach Nest 11. A shared implementation may still be reused by
backporting compatible fixes; a later dual-major proposal would require independent
proof and an explicit amendment rather than replacing this plan implicitly.

The [accepted #736 audit](nest12-ssr-audit-736.md) supplies the bounded proof cells.
[#33](https://github.com/anarchitects/anarchitecture-community/issues/33) owns
adapter neutrality and native Node/Express delivery. Neither additional adapter
is required for an independently validated Fastify-only Nest 12 release. Preserve
the separately reviewed native-Node-first implementation sequencing; this decision
does not select which new adapter lands first or change any default.

## Amendment — 15 November 2026: patched Angular feature baseline

During #739, a fresh audit of the original Angular22.1.4/SSR22.1.6 reference
lock identified SSR-related advisories. Johan explicitly approved narrowing the
initial Nest12 installation policy to **Angular framework `~22.2.6` and SSR
`~22.2.7`**. Exact proof uses framework22.2.6, SSR/build22.2.7, TypeScript6.0.3
and isolated Nx24.0.6 consumers. The earlier reference remains historical
compatibility evidence, not an advertised or required feature-line support cell.

This amendment supersedes only the initial feature-line Angular ranges and their
reference-cell requirement below. Nest11's published peer contracts and patch-only
maintenance policy are unchanged; those historical dependencies still require
independent security review before a maintenance release. Nest, Fastify, Node,
release-line/channel policy and #740 certification remain unchanged. See the
[#739 evidence](nest12-ssr-compatibility-739.md). Acceptance of this narrower
policy does not authorize publication or declare production readiness.

## Evidence and architecture boundaries

Reviewed Community `27b5f66bf5e3fcf9429df0c73d22c0b232194980`, with merged ADR0005
amendment PR #746, and Meta main `b2cc857bef3ecc4180ca8180db015ba5537bc497`.
The preceding full preflight read all 9 Community and 24 Meta ADRs, every status.
This review re-enumerated the records, verified the unchanged Meta revision and
the sole local ADR change since that preflight, and read the amended SSR and
versioning decisions plus current contribution, ownership, SDLC and release guides.
The proposed governance records remain proposals. Relevant accepted constraints
are Community0004–0007/Modern Angular and Meta HTTP0008/0009, 0010, 0013–0021:
preserve published compatibility, Nest 11 patches, independent versions, human
dependency review, evidence-backed execution and separate owner release authority.

Community PR #747 and Meta PR #53 were open when inspected on 15 November. Their
native-Node-first sequencing proposals do not establish implemented support or
override merged records before acceptance. Reconcile any subsequently merged
amendments before implementation; the line separation here does not depend on
Express being implemented first.

Fresh read-only registry/tag/release inventory found npm versions `0.1.0`, `0.2.0`,
`0.2.1`, `0.3.0`, `0.3.1`, `0.3.2`, with only `latest → 0.3.2`; all six Git tags
exist. The non-draft `0.3.2` GitHub release was published on 25 October 2026. The
old `0.1.0` history is grandfathered, not a reason to restart at `0.0.1`. This is
version-history evidence, not a new tarball-integrity or runtime certification.
Refresh all histories at actual release preparation.

## Peer, engine and proof policy

The following are **accepted policy inputs to #738/#739**, not changes to today's
manifest. No range is advertised until the corresponding #740 evidence passes.
Use exact versions in reviewed consumer locks; install without force/legacy-peer
bypasses, source aliases or workspace dependency leakage.

| Concern                              | Initial Nest 12 candidate policy (as amended)                    | Nest 11 maintenance policy                                                                      |
| ------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Nest common/core/platform-fastify    | `~12.5.0` each; coherent 12.5.0 proof                            | Retain common/core `^11.0.0` and adapter `^11.1.29`; security-current Nest proof target 11.2.10 |
| Angular core/platform-browser/router | `~22.2.6`; coherent 22.2.6 proof                                 | Retain `^21.0.0 \|\| ^22.0.0`; existing maintenance cells/contracts remain                      |
| Angular SSR                          | `~22.2.7`; SSR/build22.2.7 with framework22.2.6                  | Preserve existing peer contract and separately pinned SSR/build train                           |
| Fastify/static                       | Fastify `~5.12.8`; static `~10.1.11`; exact proof 5.12.8/10.1.11 | Keep Fastify `^5.0.0`; patched proof and any floor tightening require review                    |
| Node                                 | `>=24.22.3 <25`; exact proof 24.22.3                             | No restrictive engine added as an unreviewed patch; current proof uses 24.22.3                  |
| Tooling                              | TS6.0.3, isolated Nx24.0.6 for Angular22.2                       | Retain TS5.9.3/Nx22.6.0 or 23.1.2 for Angular21, TS6.0.3/Nx23.2.1 for Angular22.1               |

These deliberately bounded feature-line ranges admit compatible patches within
the selected minor trains, not untested Nest/Angular minors. Range syntax is an
installation contract; the support table must separately name actually tested
locked combinations. Any later range expansion requires reviewed boundary/current
consumer proof. Tooling versions are fixture/build inputs, not new SSR runtime
peers. Preserve reflect-metadata's existing peer contract; the audit pins 0.2.2
and RxJS7.8.2 in consumers. The framework, compiler and SSR/build packages must
form coherent cells, not an arbitrary Cartesian product of the table.

Retain CJS and ESM public loading and strict declaration resolution; require the
real split Angular ESM-server/CJS Nest-host and hydration proof. Node22/26,
Angular21/22.1 on Nest12, Nest12 minors below12.5, and native Node/Express support are
outside the initial Fastify certification. Native Node is an approved target
under ADR0005; its own version/peer selection and optional adapter imports must
be coordinated through #33/#42/#43 without a second release-line policy.

### Historical Nest 11 floor and security

Retaining a peer range is not a claim that every historical resolved dependency
tree is secure. The audit found vulnerable nested Fastify5.11.0 under adapter
11.1.29; a newer top-level Fastify alone does not repair it. Prefer upgrading
within Nest11 to the coherent 11.2.10 security-current target, followed by the
locked conformance and full-tree audit. Do not rewrite historical test results.

To retain the old adapter floor in a future maintenance release, #738 must add a
distinct bounded compatibility fixture for 11.1.29 with a **consumer-root override**
that resolves every relevant Fastify copy to the reviewed patched version, and
prove it with #740. Document that explicit consumer configuration and verify its
installed tree; a dependency package's own override cannot fix downstream installs.
The unmodified vulnerable tree remains historical evidence, not an approved
deployment recommendation. No hidden package override or weakened security gate
is an acceptable substitute.
[npm root-override semantics](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides).

If that patched old-floor fixture cannot preserve the contract, stop maintenance
publication and return to Johan with an explicit floor-change decision. Raising
the advertised Nest/Angular/Node floor or removing a public API is not a silent
`0.3.x` patch. It requires a reviewed breaking migration and another available
minor/version-line decision under ADR0007; do not reuse the Nest12 `0.4.x` identity
for incompatible Nest11 artifacts. This contingency does not assert that the
old-floor fixture already passes or authorize a policy exception.

## Branch, backport and channel routing

Before the first Nest12-breaking implementation merges, preserve the last reviewed
Nest11-compatible main commit as the protected maintenance branch base. Retain
the published `nest-angular-ssr@0.3.2` tag and record the base commit/tree and its
relationship to that release. The branch is specified here, not created. Include
needed fixture/security fixes deliberately; do not assume its old lockfile or CI
is the current safe baseline.

Develop features on main. For a shared fix, link the original and backport PRs,
adapt the patch to the destination, retain Conventional Commit intent, and prove
both line-specific consumers. Urgent Nest11-only fixes can originate on maintenance
and receive a separate reviewed forward-port assessment. Never merge all of main
back into maintenance or copy its Nest12 manifest/version/lock wholesale. No new
adapter features go to Nest11. No end-of-support date is invented by this decision.

| Illustrative operation                    | Required routing and acceptance                                                                                                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial Nest12 `0.4.0`                    | Nx derives the breaking bump from actual commits/history. Publish only owner-approved, certified stable bytes to `next`; this is a full release, not an unapproved prerelease.           |
| Promote that release                      | Verify identical published bytes and readiness; obtain a separately authorized channel action to move `latest` to that exact version. Do not republish.                                  |
| Preserve Nest11 discoverability           | Before moving latest, explicitly authorize and verify `nest11` pointing at the selected existing Nest11 version; adding a label does not certify its security.                           |
| Later Nest11 `0.3.3` after `0.4.0` exists | From the protected maintenance line, apply only compatible fixes and a line-local Nx patch bump. Publish to `nest11`; leave `latest` and `next` unchanged. Requires #748.                |
| Later compatible Nest12 feature           | On `0.x`, an ordinary feature/fix advances patch (for example `0.4.0 → 0.4.1`); a breaking change advances minor. Fresh Nx/history and owner evidence decide the actual version/channel. |

The channels are accepted policy, not current registry state. Publish requests must
select them explicitly; npm's default `latest` is inappropriate for maintenance.
Moving a channel cannot replace manifest compatibility, archive integrity or an
application owner's upgrade decision. Dist-tag-only installation is mutable;
consumers should retain a reviewed version/lock and migration evidence.
[npm dist-tag documentation](https://docs.npmjs.com/adding-dist-tags-to-packages/).

## Required release-control follow-up

[#748](https://github.com/anarchitects/anarchitecture-community/issues/748) owns
the concrete maintenance-route gap. The current implementation cannot execute
the accepted post-cutover maintenance example:

| Current constraint                                                                         | Source evidence                                                                                    | Required change in #748                                                                                                           |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Preparation requires current main and defaults every selected channel to latest            | [prepare.mjs](../../tools/release/prepare.mjs), version/freeze                                     | Reviewed line/branch and explicit channel inputs; retain trusted preparation.                                                     |
| New versions must exceed all observed history                                              | [policy.mjs](../../tools/release/policy.mjs), validateVersion                                      | Advance within an explicitly approved line while preserving global uniqueness, fresh complete history and a distributed baseline. |
| Preparation controller and candidate SHAs must match; provenance and new tags bind to main | [execution.mjs](../../tools/release/execution.mjs)                                                 | Separate trusted main-controller provenance from immutable maintenance-candidate identity, with equivalent owner/evidence checks. |
| Candidate must be integrated on main; exact CI requires a main push                        | [controller.mjs](../../tools/release/controller.mjs), [github.mjs](../../tools/release/github.mjs) | Approved protected source-line CI/head validation; no arbitrary branch/tag or candidate-code privilege.                           |

This needs an explicit amendment to the accepted [control design](../release-controls.md)
and [version guard contract](../release-version-policy.md), with implementation
and tests. It is not permission to disable those checks. Keep privileged execution
and environment admission on protected main. Record candidate and controller
identities separately; perform candidate builds without publication/App credentials.
Preserve exact archives, numeric-owner review, first-attempt rules, protection,
history, channel approval, concurrency, retry/receipt and archive requirements.
The current record/guard must continue rejecting unsupported maintenance attempts
until the reviewed replacement exists. Manually editing a channel or creating a
maintenance tag does not bypass the other main/history constraints.

Verify line-local Nx tag selection on divergent histories with both lower and
higher versions present. Do not filter away global history conflicts to make a
test pass. Tests must prove a lower maintenance patch is allowed only for the
configured package/line, while wrong branches, cross-line channels, duplicate
versions, unpublished baselines, inadequate bumps and forged evidence fail closed.

## Delivery and acceptance

| Work        | Boundary                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| #737        | Johan accepts this policy, floor-preservation strategy and required follow-up. Acceptance is not runtime certification.                            |
| #738 / #739 | Create the exact locked proof cells and implement compatibility on the chosen lines; preserve the published facade and prove any necessary change. |
| #740        | Certify the real artifacts, declarations, security, HTTP/lifecycle and hydration behavior; no unsafe old-floor or inferred streaming claim.        |
| #748        | Implement and verify the protected maintenance route and revised design, after #737 acceptance. It can proceed alongside #738/#739.                |
| #741        | Confirm both feature readiness and a concrete viable maintenance path, including #748, plus accurate packed README/migration/channel guidance.     |
| #722 / #742 | Resume release planning only when Johan instructs; separately activate the relevant controls and authorize/publish the exact candidate.            |

Johan explicitly accepted the separate lines, initial bounded peer/engine policy,
retained-floor proof strategy and channel/control follow-up on 15 November 2026
(Europe/Brussels), and authorized committing, pushing and opening the documentation
PR. #737 remains In Review until that accepted decision is delivered through merge;
the PR may close the decision issue. This acceptance does not certify the proposed
runtime combinations, implement #748 or authorize a release. Implementation and
publishing tasks remain open. Release records/archives/receipts retain the agreed encrypted USB
**Anarchitects** and second backup **Asustor Lockerstor AS6604T**, under Johan.

This work only inspected source/history and prepared documentation. It did not
run version preparation, change dependencies, create maintenance/release tags,
move channels, activate #722, publish, or establish downstream adoption. Local
format/link checks validate the document only; runtime proof belongs to the
follow-ups above.
