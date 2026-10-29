# Editor.js bounded Nest upload reference — SI-72.6

Issue [#631](https://github.com/anarchitects/anarchitecture-community/issues/631)
adds a consumer-copyable application example to the actual
`@anarchitects/editorjs-upload-fetch` archive. There is no new public Nest
package, generic runtime dependency, or Nx project. The existing private
`editorjs-angular-e2e` fixture area owns the isolated installs and validation.

## Architecture preflight and scope

All eight Community ADRs in `docs/adr/**` and all eighteen Meta ADRs in
`adr/**` were enumerated and read, including proposed and historical content,
on 2026-10-29. Meta was checked at
`823568eeadb56d848c32e8a3d3b4adfae7b2a1c5`; its GitHub ADR inventory matched
the clean adjacent checkout. No additional local ADR location was found.
The full review was repeated when the maintainer explicitly added native Node
to the Fastify reference scope. The Modern Angular guide index, repository
application, architecture, testing/migration and validation guidance were also
reviewed; this slice does not change Angular runtime code.

- Meta 0008/0009/0010 and local 0005/0006 require real evidence per adapter,
  a Nest 12 feature track and preservation of Nest 11/Fastify SSR. Two upload
  examples do not promote native Node to the ecosystem default or establish
  SSR, webhook, cookie, proxy, OpenAPI or production performance parity.
- Meta 0011/0012 keep identity/policy with the host and shared canonical API
  ownership outside this example. These DTOs, endpoints and failure codes are
  local application choices. Zod runs at the presentation boundary via Nest's
  Standard Schema body binding. No shared contract package is invented.
- Community 0004 requires complete consumer documentation in the packed
  artifact; the test extracts and compiles that guide, not a parallel source
  copy. Contributor evidence belongs here.
- Meta 0013/local 0007 retain unreleased `0.0.1`, non-bumping `init` and exact
  Nx project scopes (`editorjs-upload-fetch`, `editorjs-angular-e2e`). No release,
  publication, merge or package-support widening is part of this slice.
- Meta 0015 requires isolated, complete cache inputs/outputs and safe DTE
  prerequisites. Fresh registry resolution remains uncached preparation;
  validation consumes an immutable, integrity-checked snapshot.
- Local Angular A02/A10 and the existing Editor.js contracts preserve neutral
  core/Fetch ports and packed consumer boundaries. Alt remains unset, authored
  or decorative at the host; the server returns asset metadata without alt or
  caption inference.

Governance enrichment/hierarchy/Archi/layering proposals remain proposed. No
accepted-ADR conflict or exception is introduced. The maintainer's explicit
native Node addition is recorded in #631; the earlier #626 selection is retained
as the historical Fastify baseline.

## Exact installations and ownership

Common server dependencies are Nest common/core **12.3.2**, reflect-metadata
**0.2.2**, RxJS **7.8.2**, Zod **4.6.7**, TypeScript **6.0.3** and Node types
**24.10.1**. Both executions use an independently installed Node **24.15.0**
binary and assert its actual version.

| Atom suffix           | Independent server installation                                                    |
| --------------------- | ---------------------------------------------------------------------------------- |
| `nest-upload-fastify` | `@nestjs/platform-fastify@12.3.2`, Fastify **5.12.7**, `@fastify/multipart@10.1.6` |
| `nest-upload-node`    | `@nestjs/platform-node@12.3.2`, its bundled Multer **2.5.0**                       |

The published package declarations and official Nest upload/HTTP adapter docs
were inspected before implementation. Each server installs only its selected
platform. The sibling browser consumer installs the actual core/Fetch archives
and TypeScript, with no Nest, Angular, Fastify or Multer dependency. The fixture
asserts real paths, missing framework resolution and browser bundle sources.
Workspace Vite/Playwright are test tools; they do not alias package sources.
Fresh npm locks, package archive hashes and direct resolved versions survive in
preparation evidence. An adapter version change requires fresh preparation.

## Controls and limitations

The guide separates application ports/storage from Nest presentation. Both
adapters run the same positive and negative cases through actual HTTP:

- Named File, nameless Blob and allowed URL submission map through packed Fetch
  to core results; the returned media bytes equal the controlled image.
- Strict DTO validation, bounded JSON and multipart parsing, missing/extra
  parts, MIME/content policy, missing/invalid operation keys, authentication,
  authorization and revoked replay fail closed before storage as applicable.
- Exact local URL allowlisting resolves known bytes without an outbound fetch.
- Duplicate/concurrent file and URL attempts, operation-key conflicts and
  user/tenant namespaces exercise atomic in-process deduplication.
- A test-only same-origin proxy stalls a partial response **after** the real
  Nest handler commits. Sending headers prevents Chromium's connection retry
  from standing in for the documented core retry. Two distinct multipart
  boundaries prove fresh request bodies; the stable key stores one asset.
  Timeout/replay separately demonstrates that local failure is not
  remote rollback. Internal storage failures expose a sanitized envelope.
- Storage capacity is bounded, old receipts remain replayable at capacity,
  and new keys fail instead of evicting deduplication state.

The local identity value and one-PNG content policy are demonstrations. The
memory store's atomicity is only for one process lifetime; there is no durable
or distributed idempotency claim. Production identity/session authority,
policy, image validation/scanning, durable storage, quotas, media access,
retention, HTTPS, proxy/CSRF/CORS/rate controls and operational certification
remain host work. The guide explicitly lists these requirements. No real
credentials, vendor service, deployment or unrestricted URL import is used.

## Nx execution and evidence

The two new atoms belong only to the reference CSR cell, reusing its Node
24.15.0 installation. This is orchestration reuse, not an Angular dependency
of the backend/browser example. The graph has **89** distributable atoms:
seven CSR and twenty-two SSR per existing cell, plus these two references.
Both have `cache: true`, unique per-invocation outputs and no uncached task
dependency. The reference preparation builds/packs Fetch and adds independent
server/client installations to `nest-upload.tar.gz` inside the consumer
snapshot. Atoms extract into separate external temporary directories, bind
ports with `listen(0)`, close browsers/servers, and remove consumers on exit.

The source fingerprint includes the Fetch archive sources/manifest/guide and
preparation helper. Nx additionally hashes the test code, dependency graph,
workspace lock/config, runtime/environment and snapshot identity. Existing CI
selects all atoms from `packed-targets.mjs`; collection requires both reports.
Graph tests assert their restricted cell membership and reject uncached DTE
dependencies. No separate manual CI job partition is added.

Run the existing complete reference coordinator with:

```sh
yarn nx run editorjs-angular-e2e:e2e-packed --cell=angular22-reference
```

For diagnosis, prepare with a unique `EDITORJS_PACKED_RUN_ID` and matching
`--runId`, then run `packed-csr-angular22-reference-nest-upload-fastify` and
`packed-csr-angular22-reference-nest-upload-node` under that ID. Reusing an ID
is only for the identical snapshot; a package/preparation-source or install
change requires a fresh ID. Test-only changes can consume that unchanged
snapshot, but must invalidate the Nx validation task. Preserve the full
collection gate for complete cell claims.

### Validation on 2026-10-29

- Fresh snapshot `si631-nest-v2` on macOS arm64, with the exact dependencies
  above; both backend and browser TypeScript consumers compiled from the guide
  in the packed archive. Actual browser: Chromium **156.0.8078.4**.
- **16 scenario groups per adapter**, all passed. Each verifies actual HTTP
  behavior and browser core-result mapping; native Node and Fastify have
  separate reports and no platform dependency fallback.
- **All nine reference CSR atoms plus the completeness gate passed**:
  [Nx run](https://cloud.nx.app/runs/iT6Gfc0nxA), 75 seconds locally with
  parallelism two. This includes the existing portable, interop, build,
  editor, Forms and upload paths. Source changes to the validation driver
  invalidated the tasks (0/9 cache hits).
- Deleted both Nest atom output directories, then replayed with unchanged
  inputs: **2/2 cache hits, all 20 files restored byte-for-byte** in 483 ms.
  [Nx cache replay](https://cloud.nx.app/runs/dNd8x0OOt2). The completeness gate
  passed again after restoration. Both reports record server/browser cleanup;
  the phase runner removed the external consumers.
- Fetch **45 unit/package checks**, **21 existing browser scenarios**, lint
  and typecheck passed. E2e lint/typecheck and all **seven packed-harness
  tests** passed, including the 89-atom graph, isolation and failure collection.
  Existing e2e lint warnings remain; there are no lint errors.

Snapshot SHA-256:
`a11aec85df848f8af4af87d2b174041ff50a857ebd31dd5e515bb380c7ab23bc`.
Fetch archive SHA-256:
`1b9ac5c6c9b1837159e6acf8746c7637a2d44c6707f2a4a168bbd6618355068f`.
Locks and reports are under `dist/editorjs-packed-inputs/si631-nest-v2` and
`dist/editorjs-packed-results/si631-nest-v2`; they are generated evidence,
not committed dependency manifests or public-package contents.

These are **local execution/cache-restoration results**, not a hosted DTE
performance claim. Existing CI automatically schedules both new atoms and
requires their reports; hosted Linux results belong to the PR checks. The full
three-cell CSR/SSR/hydration matrix and consolidated DTE review remain #632.
Registry lookup returned no Fetch publication and there are no Editor.js
release tags; this change remains unreleased `init`, without a version bump.
