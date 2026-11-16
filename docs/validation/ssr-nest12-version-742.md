# Nest 12 version proposal — #742

Review date: 16 November 2026. Owner: Johan, SSR capability owner.
Status: version proposal authorized for commit/push/PR; hosted preparation and
publication have not run. Johan will inspect the normal PR CI.

**Follow-up, 16 November:** PR #773 merged at
`691f96b8dec8023c7074377090123361aa97597a`. Johan then requested alignment with
Nx's configured GitHub-only changelog policy. The [changelog handoff correction](nx-release-changelog-773.md)
supersedes this proposal's file-based notes mechanism; the derived version,
package bytes and recorded consumer proof remain unchanged. The conditional
hosted preparation authorization remains unconsumed until the correction is
integrated and exact-main CI passes.

## Version and scope

The installed Nx release engine derived **0.4.0 → 0.5.0** from complete release
history, with `checkAllBranchesWhen: true`. The source baseline is main
`a50b0094315e5b4814553d1fde7d80d655fe7fb8`. The published maintenance tag
`nest-angular-ssr@0.4.0` resolves to
`49cfb7208ff555402dd39dd339accb5178371b53`; its GitHub release and npm version
satisfy the accepted maintenance-first prerequisite. No version override,
maintenance-source merge or new runtime dependency was used.

The proposal changes only the SSR manifest version, package documentation,
changelog and integrated `.release/request.json`, plus this review record. The
request selects exactly `nest-angular-ssr`, `line=nest12`, `channel=next` and
breaking compatibility evidence. The already accepted installation requirements
remain Node `>=24.22.3 <25`, Nest `~12.5.0`, Fastify `~5.12.8`, Angular framework
`~22.2.6` and SSR `~22.2.7`. Public APIs and runtime implementation are unchanged.
Express/native Node support is not claimed. Existing response buffering and lack
of renderer cancellation on client disconnect remain documented.

Nx's generated changelog contained raw changed-file lines from an earlier commit
body and obsolete maintenance numbering. Its consumer-facing copy was reconciled
with the accepted release-note draft in
[the publication plan](ssr-publication-planning-742.md#nest-12-release-note-copy--version-pending).
The original generated output is retained locally at
`/private/tmp/742-nest12-nx-changelog.md`; this editorial cleanup does not change
Nx's version calculation. The packed README names the actual 0.4.0 maintenance
release and gives the 0.5.0 installation command with a registry-availability
qualification. A local proposal does not assert publication.

## Architecture preflight

Enumerated and read all **25 Meta ADRs** at
`4f0339d86f0ebfa073173ad307cb67c8d6042bdd` and all **nine Community ADRs** at the
source baseline, including accepted, proposed and historical records. Reviewed
CONTRIBUTING, OWNERSHIP, the SDLC, Modern Angular's repository application,
SSR/build and testing guides, accepted #737 amendments, #740/#741 evidence and
the #748 release procedure.

Community ADR0004–0007 and Modern Angular require truthful packed documentation,
preserved public SSR APIs and exact consumer evidence. Meta HTTP0008/0009 and
0010–0012 keep adapter delivery separate from framework compatibility; native
Node's architectural acceptance does not block this Fastify-only release.
Meta0013/0015–0019 retain Nx version authority, uncached fresh external checks,
owner authorization and honest delivery status. Meta0022 preserves per-framework
maintenance clocks; the accepted Angular 21 exception ends 13 February 2027,
inclusive. No Nest 11 EOM date is invented: initial `next` availability and a
separately reviewed general-availability decision remain distinct. Proposed
governance clauses do not override accepted decisions. No unresolved architectural
contradiction was found for this version-only proposal.

## Validation

Local version preparation completed with Node24.22.3/Yarn4.18.0 and Nx Cloud
disabled. Logs: `/private/tmp/742-nest12-version.log`. Fresh tag/release/npm history
at 10:35:12 UTC contains 0.4.0 and no 0.5.0; the history gate passed.

The full local SSR release gate passed: build, typecheck, unit tests, lint,
browser installation, 12 consumer lifecycle tests and 10 locked-runner tests.
The versioned archive passed **21 packed-consumer checks** across N12-current
(15) and N12-split (6), including real HTTP behavior and browser hydration/event
replay. Both fresh runtime-only audits report **zero vulnerabilities**. This
is dated evidence, not a guarantee of absence of vulnerabilities.

[The evidence JSON](ssr-nest12-version-742-evidence.json) retains exact pins,
source/input hashes, dirty proposal state, locks, checks and archive identity.
The actual package version is 0.5.0; its SHA256 is
`58f770cd0cfd1402cb1404d102366a32a374ea2ca017e3ffbf85b3edbffe40ef`.
The archive audit inspected 36 files, confirmed current README bytes, root-matching
LICENSE, NOTICE, public exports and no local runtime dependency protocols.
Detailed logs and bytes are under
`dist/validation/nest12-ssr-740/nest12-hzC6Xv/`; gate output is
`/private/tmp/742-nest12-validation.log`.

This is local macOS/arm64 proof on Node24.22.3/npm11.19.1, Playwright1.64.0 and
Chromium156.0.8078.4. The preparation workflow must still rebuild and certify
the final integrated candidate. No hosted CI, remote cache/DTE restoration or
durable archive copy is claimed.

## Remaining release gates

1. Johan authorized this concrete commit/push/PR and its normal hosted CI on
   16 November; he retains PR CI inspection, review and merge.
2. After Johan merges, verify successful exact-main CI and run/inspect **one**
   Nest 12 0.5.0 hosted preparation for `next`, conditional on fresh history and
   integrated-request checks passing. Johan explicitly authorized that bounded
   preparation and inspection on 16 November. Inspect its final immutable
   archive, all consumer/audit evidence and record identity before selecting the
   candidate. Reruns are excluded; the authorization is not yet consumed.
3. Reconcile #722 for this candidate. Controls are paused. The previous temporary
   activation exception covered only Nest 11 0.4.0 and does not carry over.
   Better Auth and Editor.js HTML Angular's legacy npm paths remain unresolved;
   their cleanup was stopped at Johan's request after npm errors.
4. Execute only the owner-approved exact release through both required protected
   environment approvals. Publish initially to `next`; leave `nest11` and
   `latest` unchanged. Promotion to `latest` is a separate reviewed action.
5. Independently verify actual registry availability, archive identity, channels
   and provenance. The 0.4.0 publisher accepted the upload but failed its immediate
   visibility check before npm finished processing. Do not retry an accepted
   upload merely because immediate registry verification reports absence; retain
   the original receipt and subsequent reconciliation. This proposal does not
   change the controller's verification behavior or claim that follow-up fixed.
6. Johan retains records, exact archives and receipts on encrypted USB
   **Anarchitects** and **Asustor Lockerstor AS6604T** before hosted expiry.
   Published consumer handoff and owner acceptance complete #742; neither durable
   copies nor application adoption is inferred from publication.
