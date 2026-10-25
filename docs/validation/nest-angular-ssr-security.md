# Nest 11 SSR security maintenance — #584

Reviewed 2026-10-25 for [Community #584](https://github.com/anarchitects/anarchitecture-community/issues/584),
upstream of [FoF #143](https://github.com/anarchitects/fitoverforty/issues/143)
and [FoF #163](https://github.com/anarchitects/fitoverforty/issues/163).
The host's independent Fastify patch remains [FoF #160](https://github.com/anarchitects/fitoverforty/issues/160).

## Architecture preflight

Read all eight local ADRs (`docs/adr/0001`–`0007` and Modern Angular) and all
17 records in the sibling `anarchitecture-meta/adr` checkout, including both
0001/0008 records and the legacy `ADR-0001.md`. Meta's cooperative enrichment,
governance hierarchy, Archi and workspace layering records remain proposals.
No additional local ADR location was found. Also reviewed the Modern Angular
guide, repository application, SSR/builds, testing/migration and validation
guides, package documentation and existing fixture runners.

Applicable accepted decisions: local 0004 requires accurate packed consumer
documentation; 0005 preserves Fastify, API boundaries, hosts, cookies, HEAD,
fallback and CJS/ESM; 0006 and Meta 0010 keep Nest 11 patch-only. Meta 0008/0009
require demonstrated compatibility without switching adapters. Local 0007 and
Meta 0013 retain Nx Conventional Commit release authority. Modern Angular
A01/A09–A12 preserve the existing Angular ranges and require artifact evidence.
No accepted-decision conflict was found. Neither Nest 12 nor adapter-neutral
SSR is introduced by this maintenance change.

## Upstream security and compatibility

Live npm metadata selected `@fastify/static 10.1.7`. The official
[compatibility table](https://github.com/fastify/fastify-static#compatibility)
and the installed plugin's registration metadata both specify Fastify 5.
All eight entries in the upstream advisory inventory were checked; the six
for the scoped package are below. The other two concern the historical
unscoped `fastify-static` package, not this dependency.

| Advisory                                                                                                                                | First patched version |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| [GHSA-pr96-94w5-mx2h](https://github.com/fastify/fastify-static/security/advisories/GHSA-pr96-94w5-mx2h), directory listing traversal   | 9.1.1                 |
| [GHSA-x428-ghpx-8j92](https://github.com/fastify/fastify-static/security/advisories/GHSA-x428-ghpx-8j92), encoded separators            | 9.1.1                 |
| [GHSA-83w8-p2f5-377r](https://github.com/fastify/fastify-static/security/advisories/GHSA-83w8-p2f5-377r), non-leading traversal         | 10.1.1                |
| [GHSA-8pvw-jcv7-9cmj](https://github.com/fastify/fastify-static/security/advisories/GHSA-8pvw-jcv7-9cmj), allowed-path canonicalization | 10.1.2                |
| [GHSA-423g-23ch-w7c6](https://github.com/fastify/fastify-static/security/advisories/GHSA-423g-23ch-w7c6), dot/duplicate-slash segments  | 10.1.3                |
| [GHSA-r799-r9gc-m956](https://github.com/fastify/fastify-static/security/advisories/GHSA-r799-r9gc-m956), case aliases                  | 10.1.4                |

10.1.2 alone is insufficient. No upstream patched 8.x maintenance release was
identified. The scoped dependency moves to `^10.1.7`; there is no fork or
unverified peer widening. Nest's adapter first declares a compatible optional
static peer (`^10.1.2`) in 11.1.29, so the SSR adapter peer minimum becomes
`^11.1.29`. Earlier Nest 11 adapters must be upgraded before adoption.

This library uses `serve: false` and its own routing. It must reject ambiguous
raw paths before URL/filesystem normalization, rather than relying only on the
plugin's wildcard fixes. Supplying `allowedPath` also enables upstream's exact
filesystem spelling checks for manual `sendFile` calls. Ordinary encoded asset
names and query strings remain supported. Browser assets must be public output;
the package does not turn an asset directory into a private-file storage service.

## Validation and deployment matrix

Local validation uses Node 24.22.1 on macOS. Packed tests resolve the actual
installed package, its static dependency and public CJS/ESM exports; they also
check that the consumer README is present. No workspace source alias is used
by the security conformance runner.

| Consumer                            | Actual adapter/server                              | Evidence                                                                                                            |
| ----------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| CJS and ESM, Angular 21             | Nest adapter 11.2.8, Fastify 5.12.7 host override  | Packed registration, security conformance and live Angular SSR/asset/API requests                                   |
| Angular 21.2.0, TS 5.9.3, Nx 22.6.0 | Nest 11.1.29, bundled Fastify 5.11.0               | Minimum-version compile and packed security conformance                                                             |
| Angular 21.2.0, TS 5.9.3, Nx 23.1.2 | Nest 11.1.29, bundled Fastify 5.11.0               | Minimum-version compile and packed security conformance                                                             |
| Angular 22.1.4, TS 6.0.3, Nx 23.1.2 | Nest 11.1.29, bundled Fastify 5.11.0               | Minimum-version compile and packed security conformance                                                             |
| Split Angular 22 / Nest CJS webpack | Nest adapter 11.1.29, Fastify 5.12.7 host override | Production frontend/backend builds, packed security conformance and live SSR/static/API/redirect/HEAD/host requests |

The minimum-version cells prove compatibility, **not** that old bundled Fastify
versions are security-current. A live production dependency audit found only
Fastify advisories in the unoverridden consumer; none were in the updated static
plugin chain. The deployment CJS/ESM fixtures with the host's Fastify 5.12.7
override reported zero npm audit vulnerabilities at validation time. Development
toolchains and historical minimum-version cells still report unrelated alerts;
this is not a repository-wide dependency remediation.

The conformance suite covers GET/HEAD assets and pages, API hits/misses and
asset collisions, missing assets, SSR null fallback, redirects, distinct
Set-Cookie headers, incoming cookies/query/context, disallowed hosts, trusted
and untrusted CIDR proxies, forged forwarded headers, dot/duplicate-slash paths,
encoded separators, case aliases, malformed encodings, null bytes and attempted
root traversal. Denied paths may not return a sentinel file or invoke SSR.
Linux/macOS consumer CI covers both filesystem casing behaviors.

Reproduce from a Node 24 checkout with registry access and local ports available:

```sh
yarn install --immutable
yarn nx sync
yarn nx run @anarchitecture-community/source:validate-nest-angular-ssr-release-gate
```

Package build/typecheck/lint and all 99 existing tests pass. Packed CJS/ESM,
all three minimum-version cells and the split deployment fixture pass locally.
Lint retains four pre-existing unused-parameter warnings in registration tests.
CI jobs and a package-specific pre-publication gate run these conformance checks;
hosted CI results are still required on the reviewed commit.

## Release and adoption gates

`@anarchitects/nest-angular-ssr@0.3.2` was manually published by the maintainer
on 2026-10-25. npm metadata verified that day identifies:

- [Published package](https://www.npmjs.com/package/@anarchitects/nest-angular-ssr/v/0.3.2)
  and [immutable tarball](https://registry.npmjs.org/@anarchitects/nest-angular-ssr/-/nest-angular-ssr-0.3.2.tgz).
- Release tag: `nest-angular-ssr@0.3.2`; npm `gitHead`:
  `ae31ea974a6659efaee7746b2831db80ba35445e`.
- npm integrity:
  `sha512-TZYeSr+wZ3EhkgaP+7ELvxk5/VtMpLoQEmAvOnpJ9s4bRDbI1ZlJvpXo4yZQDAHeqZW0jXFPhJz/uWfmVSCecw==`.

The [publication validation run](https://github.com/anarchitects/anarchitecture-community/actions/runs/40178049767/job/121122924963)
passed all 99 unit tests, both packed security-conformance checks and direct
CJS/ESM consumer checks, but the Ubuntu consumer runner did not exit. The run
was **cancelled**, completing cancellation at 08:58 UTC. The affected PR/main
runs were also cancelled at the maintainer's request; macOS consumers and the
other 16 jobs passed in those runs. These are partial results, **not green full
pipelines**. [Community #590](https://github.com/anarchitects/anarchitecture-community/issues/590)
tracks the runner defect and exit verification separately from publication.
Do not republish or replace immutable npm version 0.3.2.

FoF adoption remains separately tracked in
[FoF #163](https://github.com/anarchitects/fitoverforty/issues/163). Record the
reviewed consumer commit, green hosted CI and packed runtime results when
adopting the published artifact; local runner validation does not establish
hosted CI success or completed deployment.

Deployment prerequisites: upgrade the Nest Fastify adapter to at least 11.1.29,
retain the independent host Fastify security patch (including Nest's nested
copy), configure `trustProxy` for the real proxy addresses, and allowlist the
public hostname. Forwarded host/protocol headers are no longer trusted by
default. Keep the reviewed lockfile and public-only browser output.

If release/adoption is delayed, a short-term mitigation is to disable this SSR
registration (`enabled: false`), serve public browser output at a patched
edge/static server and retain Nest for API traffic. SSR rendering is lost in
that fallback; returning to the vulnerable static dependency is not a security
rollback. No deployment, publication or FoF source change is performed here.

## Consumer runner lifecycle — #590

The follow-up preflight read all eight local ADRs and all 17 Meta ADR records
at Meta commit `71c46b1d044804f4b8eeaa062537d1b2d72a9c04`, including proposed
and historical records. The accepted decisions and guide constraints above
still apply; no conflict or public runtime/support change was introduced.

Packed CJS/ESM attempts now launch `process.execPath` with `dist/main.js`
directly. Startup and HTTP assertions share cleanup, including spawn failure,
early exit and startup timeout. On Ubuntu/macOS the runner owns a separate
process group, sends SIGTERM, allows two seconds for closure, then sends
SIGKILL to any remaining group and allows two more seconds. It observes pipe
closure as well as process exit and releases its pipe handles even if shutdown
fails. SIGINT/SIGTERM abort pending requests, clean up the group and preserve
nonzero interruption status. Readiness probes and assertion requests have
bounded timeouts.

`test-nest-angular-ssr-consumer-lifecycle` runs before the consumer task, so the
existing Ubuntu/macOS CI jobs and the publication validation gate both include
it. Its subprocess tests assert runner exit, stopped server/descendant PIDs and
reusable ports after success, failed assertions, spawn errors, early code/signal
exit, startup timeout, stalled HTTP, ignored SIGTERM, inherited descendant
pipes and interruption during startup/assertions. All packed security checks,
the split deployment fixture and compatibility cells remain in the gate.

Validation on 2026-10-25 ran the complete
`yarn nx run @anarchitecture-community/source:validate-nest-angular-ssr-release-gate`
with `NX_DAEMON=false`, `NX_ISOLATE_PLUGINS=false` and `NX_NO_CLOUD=true`:

| Environment | Node | Result | Gate duration |
| --- | --- | --- | --- |
| macOS, local checkout | 24.22.1 | Exit 0 | 2m30s |
| Ubuntu 22.04.3, isolated ARM64 Docker container with init | 24.21.0 | Exit 0 | 2m36s |

Both runs completed all 12 lifecycle regression cases, the package
build/typecheck/test/lint tasks, direct packed CJS/ESM consumers, the split
Angular/Nest deployment fixture and all three compatibility cells. Each run
passed six packed security-conformance checks. The Ubuntu process inventory
after the gate contained no remaining fixture server or validation process.
The changed runner files also passed ESLint, Prettier and whitespace checks.
These are local macOS/container results, not hosted Ubuntu/macOS CI results;
the existing CI jobs will run the same lifecycle dependency on the reviewed
commit. No publication workflow was dispatched and no artifact was republished.
