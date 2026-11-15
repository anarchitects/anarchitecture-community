# SSR documentation and technical readiness — #741

Review date: **15 November 2026**. Accountable owner: **Johan**, SSR capability
owner and Community technical maintainer. Status: **local review prepared;
technical readiness not yet accepted**. No publication, tag, registry channel,
protected-source setup or #722 activation is authorized by this record.

## Scope and decisions

The main candidate starts at `9938077fc04843e7afc19da101e479707cd3a7c8`
(merged #748, PR #759), on `docs/ssr-release-readiness-741`. The separate Nest 11
backport starts at `4f10043d9cf49020d5e8583b5cfc2917de3efd9f`, on local branch
`fix/ssr-maintenance-readiness-741`, descended from approved anchor
`8ff34b9d627d8031321f5ac45b526ec03ed05578`. The retained evidence was captured with uncommitted review changes in both source lines.
Do not merge the old maintenance source into Nest 12 main.

Preflight enumerated and read all **25 Meta ADRs**, every status, at
`4f0339d86f0ebfa073173ad307cb67c8d6042bdd`, and all **9 Community ADRs** at the main
base above. It also covered CONTRIBUTING, OWNERSHIP, the SDLC, release execution,
#737/#748, and Modern Angular's repository application, SSR/build and testing
guides. The maintenance checkout's ADR inventory and complete differences from
main were reviewed separately. Current accepted ecosystem policy still applies
to that older source; its older documentation is not a policy exemption.

Relevant accepted constraints: Community ADR0004–0007 and Modern Angular;
Meta HTTP-platform independence/native Node candidate (0008/0009), independent
versioning and release authority, evidence/security and Nx execution (0010,
0013–0022). Proposed governance/architecture records remain proposals. No
proposal overrides accepted policy. Fastify is the implemented adapter; Express
and native Node remain #33 work and do not block this release. Nest-facing APIs,
SSR isolation, published compatibility and application release authority remain
unchanged. No runtime code, package peer range, engine, root dependency or package
version changed in #741.

## Consumer and package changes

The registry-shipped README now distinguishes unreleased source from published
support; states the bounded Nest 12/Angular 22.2/Node 24 requirements; documents
explicit Fastify bootstrap and module composition, CJS/ESM, split build ownership,
API bypass, host/proxy configuration, migration, troubleshooting and rollback.
It retains the actual buffering, HEAD, cancellation and lifecycle limitations.
Install examples require an explicitly selected, approved published version.
They do not imply that existing `0.3.2` contains Nest 12 or that proposed channels
already exist.

The maintenance backport has its own Nest 11 README, preserving the accepted
`^11.2.10` adapter floor and existing Angular peer contracts. It also enables the
existing CI workflow's push trigger for the allowlisted maintenance branch;
privileged release controllers remain on main.

The controller's archive audit found the built package lacked its LICENSE.
Both source lines now carry exact copies of the root LICENSE and NOTICE, with
NOTICE included in the package files allowlist. Both final Yarn-packed archives
pass the release controller's inventory/legal-file audit. This is packaging
metadata and legal-file delivery, not a license change.

## Patched maintenance evidence

#748's retained archive proof exposed Angular runtime findings. The active
maintenance consumer locks now select patched versions **within existing peers**:

| Cell                          | Nest    | Angular / SSR-build | TypeScript / Nx | Checks |
| ----------------------------- | ------- | ------------------- | --------------- | ------ |
| N11-A21-min-tool              | 11.2.10 | 21.2.26 / 21.2.30   | 5.9.3 / 22.6.0  | 15     |
| N11-A21-next-tool             | 11.2.10 | 21.2.26 / 21.2.30   | 5.9.3 / 23.1.2  | 15     |
| N11-A22, including split host | 11.2.10 | 22.2.6 / 22.2.7     | 6.0.3 / 23.2.1  | 18     |
| N12-current                   | 12.5.0  | 22.2.6 / 22.2.7     | 6.0.3 / 24.0.6  | 15     |
| N12-split                     | 12.5.0  | 22.2.6 / 22.2.7     | 6.0.3 / 24.0.6  | 6      |

All **69 checks pass**, including five zero-finding runtime audits. Direct cells
cover clean installation, dependency tree, declarations/builds, CJS/ESM exports
and security, module/async/explicit bootstrap HTTP behavior. Split checks cover
the existing real split-host fixture. Node is 24.22.3, npm 11.19.1, local macOS
arm64. This evidence covers exact locked combinations, not every allowed patch
or remote DTE restoration. Older vulnerable combinations are not retroactively
certified. Historical locks/results remain in the main base and #740/#748 records;
the historical reference/floor cells have not been rewritten or represented as
current security evidence.

The refreshed N11-A22 split fixture inherits the existing #738 tooling exception:
only OXC's optional WASM binding pins `@napi-rs/wasm-runtime` to peer-compatible
`1.2.5`. Native macOS arm64 builds pass; WASM fallback execution is not certified.
The existing consumer-owned Fastify override remains. Neither override changes
the published package dependencies or substitutes for the patched Nest adapter.

The first patched-lock run against the retained #740 archive hit a local
`kill EPERM` during one CJS build; its other checks and all audits passed. A full
repeat passed, and all 48 checks passed again against the final corrected
maintenance archive. The first result is retained as a failed attempt, not waived
or silently removed. No harness change was needed; the transient cause was not
established.

Additional local checks: both package builds; 12 lifecycle and 9 locked-runner
helper tests; 44 release-policy tests; 10 maintenance CI-selection tests; release
configuration, formatting and changed-document link checks. No hosted CI was
started, monitored or rerun for #741.

## Exact archives and retained evidence

[Machine-readable evidence](nest12-ssr-readiness-741-evidence.json) retains full
consumer results, manifests/inventories, hashes of changed candidate inputs,
version/changelog previews and the failed/repeated attempt. The report's
`sourceCommit` identifies the trusted **main harness**, not the maintenance
candidate; `candidateSources` separately identifies each source base and dirty
file hashes.

| Archive                         | SHA256                                                             |
| ------------------------------- | ------------------------------------------------------------------ |
| Feature development archive     | `fb29101dbb98d044e39800ea4460b0f09c60635c9f3343461411a83e65384418` |
| Maintenance development archive | `d1d33d839dd8a14e314efed62dd8128d13d24694abd01d1952069d4aff671151` |

Local archives are in `dist/validation/nest12-ssr-741-pack/`; detailed consumer
logs are in `dist/validation/nest12-ssr-741-feature/` and
`dist/validation/nest12-ssr-741-maintenance-final/`. These ignored files have not
been copied to the durable store. Both manifests still say **0.3.2**: these are
development proof bytes, cannot replace the already published version, and are
not a frozen publication candidate. Final versioned bytes require new exact
archive certification through the approved controller.

Johan is the release-evidence custodian. Retain actual release records, exact
archives and publication receipts on encrypted USB **Anarchitects**, with a second
copy on **Asustor Lockerstor AS6604T**, before GitHub's 90-day artifact expiry.
Private-key recovery and release evidence are separate inventories.

## Version and changelog review

Non-publishing Nx previews disable `preVersionCommand` and all commit/tag/push/
release creation. They select only `nest-angular-ssr`, with no dependent projects.
Against current committed history, the maintenance preview proposes `0.4.0` from
`0.3.2`. Main independently calculates `0.4.0`, but the controller **correctly
rejects feature preparation until the patched Nest 11 release is distributed**.
The accepted illustration remains maintenance `0.4.0`, then feature `0.5.0`,
subject to fresh Nx history/global uniqueness. No version is reserved. Uncommitted
#741 changes are not yet part of Conventional Commit history.

The raw main changelog preview exposes malformed trailing quote/file-status text
in the merged #739 breaking-change commit, and its historical text calls the
maintenance line `0.3.x`. Before freezing release notes, review a clean entry
stating the approved adapter floor, distinct maintenance successor and Nest 12
migration requirements. Do not rewrite published history or treat the generated
text as accepted release notes. The unmodified preview is retained for review.
The maintenance preview describes the breaking `^11.2.10` floor; final notes also
need the packaging/documentation and patched-consumer evidence from this change.

## Framework lifecycle and consumer handoff

Johan confirmed **no additional customer/application maintenance commitments**
on 15 November. Apply Meta0022's security/critical-only 90-calendar-day transition
independently for Nest and Angular; no new adapter features on maintenance.
Nest 11's clock has not started: no generally available Nest 12 SSR release is
published. Record its actual trigger and EOM when that release is authorized.

Historical inventory shows `0.2.1` advertised Angular 21 only; `0.3.0`, published
28 August 2026, advertised Angular 22 and retained Angular 22.1.4 evidence
([PR #503](https://github.com/anarchitects/anarchitecture-community/pull/503)).
Ninety days from that historical publication would be **26 November 2026**.
This is a historical calculation, **not an announced EOM**. The newly adopted
prospective policy requires Johan to review how that older release establishes
the transition and record a migration/EOM decision before withdrawing Angular 21
claims. No backdated support withdrawal is made by this PR.

| Consumer                                                                                     | Upstream handoff                                                                                                                                      | Authority and remaining work                                                                                                                   |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [FitOverForty #150](https://github.com/anarchitects/fitoverforty/issues/150)                 | Bounded Nest 12/Angular 22.2/Node 24 support, preserved host/module APIs; attach exact published version, receipt and archive evidence when available | Planning remains in #150. App PO PWG owns migration/release/adoption; preserve the app host and sequence plugin adoption after framework work. |
| [Reeves Corner Retreats #29](https://github.com/anarchitects/reevescornerretreats/issues/29) | Same contract and publication evidence, with explicit application validation and rollback                                                             | App PO PWG owns application deployment/adoption; upstream technical readiness does not satisfy its adoption epic.                              |

App PO ownership comes from the Meta ownership register; consumer-local
OWNERSHIP.md read-back returned 404 for both repositories. Johan owns the upstream
capability handoff. No implementer, application date, deployment or adoption is
inferred. Published inventory still has only `latest → 0.3.2`; proposed `nest11`
and `next` channels are not available yet.

## Remaining gates and delivery order

1. Review/deliver the main #741 changes and the isolated maintenance backport.
   Johan authorized committing, pushing and opening the main PR with its normal CI
   run on 15 November; monitoring, settings and publication are excluded. The
   separate maintenance backport remains local. Its eventual PR must
   target the approved maintenance source branch, never main.
2. Establish `maintenance/nest-angular-ssr-0.3` from the approved ancestry and
   integrate the floor/backport through protected review. A fresh remote-ref read
   found that branch absent. Complete separately authorized protection setup and
   owner read-back for main and maintenance. The main-owned
   `tools/release/source-protection.json` still has an empty `branches` object.
   Preserve signed commits, PRs, strict `main` check identity and no bypass.
3. Obtain exact successful source `ci.yml` push evidence for the selected branch
   and SHA; retain separate main-controller provenance. Local tests do not supply
   this evidence. No settings were changed or assumed effective here.
4. Review lifecycle/EOM and clean release-note decisions; Johan accepts #741's
   technical readiness only when its executable-maintenance acceptance is met.
   #748 implementation is delivered; its live setup is still a readiness gap.
5. At separately authorized release planning, resume #722's remaining activation
   and npm trusted-publisher work for an exact candidate. Run the protected main
   preparation/controller with fresh histories, final versioned archives and
   all source/protection/consumer evidence. #722 remains paused meanwhile.
6. Under #742 and explicit owner release approval, distribute the patched Nest 11
   successor to **nest11** first. It must not move latest/next. Then derive the
   Nest 12 version from that distributed baseline, recertify its final bytes and
   publish initially to **next**. Promotion to **latest** needs separate reviewed
   intent. Preserve first-attempt, approval, recovery and receipt controls.
7. Deliver exact publication receipts to the existing consumer issues and both
   archive stores. Application POs separately decide migration, release and
   adoption. Neither #741 nor a merge establishes that outcome.

No security waiver, expanded adapter support or new architectural exception is
requested. The outstanding decisions are operational setup, lifecycle date
acceptance, final release notes and owner technical/release acceptance.
