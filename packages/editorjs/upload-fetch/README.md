# @anarchitects/editorjs-upload-fetch

File and URL upload adapters for a custom HTTP backend, using native Fetch and
Editor.js core upload ports. Use this package when your editor needs HTTP uploads
without Angular, Nest or a prescribed storage service.

## Installation and compatibility

```sh
npm install @anarchitects/editorjs-upload-fetch @anarchitects/editorjs-core
```

Import the ESM `@anarchitects/editorjs-upload-fetch/browser` entry. There is no
root runtime entry, CommonJS build, framework dependency or required Nx runtime.
The package is in unreleased development at 0.0.1; until publication, install
maintainer-provided archives of both packages instead of registry names.

Use TypeScript 6.0.3 with ES2022 and DOM libraries in NodeNext or Bundler mode.
Browser execution requires Fetch, AbortController, Blob and, for the multipart
recipe, FormData. The verified browser is Chromium 156.0.8078.4 using Playwright
1.64.0. The optional image integration uses Editor.js 2.31.7 and
`@anarchitects/editorjs-tool-image` 0.0.1 (upstream image 2.10.3).
Other browsers and Node HTTP execution are not certified. Build/import tooling
requires Node >=22.12.0. Importing this entry and constructing its factories is
safe without browser globals; executing requests is a separate capability.

## Quick start: a custom backend

The host selects endpoints, request encoding, authorization and response schema.
This complete example accepts a backend success body
`{ asset: { url: string, id: string } }`, or a 2xx denial
`{ denied: true }`. It validates unknown JSON and explicitly maps it to core.
Replace these endpoint paths and the mapper with your backend contract.

<!-- upload-example-file: uploads.ts -->

```ts
import {
  composeImageUploader,
  type UploadResponse,
  type UploadedFile,
} from '@anarchitects/editorjs-core';
import {
  createFetchFileUploader,
  createFetchUrlUploader,
} from '@anarchitects/editorjs-upload-fetch/browser';

export interface Asset extends UploadedFile {
  id: string;
}
export interface Denied {
  code: 'denied';
}
export function decodeAsset(body: unknown): UploadResponse<Asset, Denied> {
  if (!body || typeof body !== 'object')
    throw new TypeError('Invalid backend response.');
  if ('denied' in body && body.denied === true)
    return { success: 0, error: { code: 'denied' } };
  if (!('asset' in body) || !body.asset || typeof body.asset !== 'object')
    throw new TypeError('Missing asset.');
  const asset = body.asset;
  if (
    !('url' in asset) ||
    typeof asset.url !== 'string' ||
    !('id' in asset) ||
    typeof asset.id !== 'string'
  )
    throw new TypeError('Invalid asset.');
  return { success: 1, file: { url: asset.url, id: asset.id } };
}

export function createUploads(signal?: AbortSignal) {
  const files = createFetchFileUploader({
    request(blob) {
      const body = new FormData();
      body.append('image', blob, 'upload.bin');
      return {
        url: '/api/assets/file',
        timeoutMs: 30_000,
        init: { method: 'POST', body, credentials: 'same-origin', signal },
      };
    },
    decode: decodeAsset,
  });
  const urls = createFetchUrlUploader({
    request(url) {
      return {
        url: '/api/assets/url',
        timeoutMs: 30_000,
        init: {
          method: 'POST',
          body: JSON.stringify({ url }),
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          signal,
        },
      };
    },
    decode: decodeAsset,
  });
  return composeImageUploader(files, urls);
}

export async function submitSelectedBlob(blob: Blob) {
  const response = await createUploads().uploadByFile(blob);
  if (response.success === 0) return { denied: response.error?.code };
  return { assetUrl: response.file.url, assetId: response.file.id };
}
```

Provide a user-selected `File` or a `Blob`; a Blob need not have `name`. Choose
an appropriate fallback filename yourself. Do not set multipart `Content-Type`:
FormData/Fetch supplies the matching boundary. The URL factory sends the supplied
string only through your request builder; it does not download remote content.
The backend must deliberately support URL ingestion or return a denial.

For image editing install `@anarchitects/editorjs-tool-image` and
`@editorjs/editorjs@2.31.7`. The following editor recipe targets TypeScript Bundler resolution (the upstream
Editor.js dynamic default import has different NodeNext declarations). The
adapter declarations and transport-only recipes also support NodeNext.
Load both browser modules only when mounting an editor:

<!-- upload-example-file: editor.ts -->

```ts
import { createUploads } from './uploads.js';
export async function mountEditor(holder: HTMLElement) {
  const [{ default: EditorJS }, { ImageTool }] = await Promise.all([
    import('@editorjs/editorjs'),
    import('@anarchitects/editorjs-tool-image/browser'),
  ]);
  const editor = new EditorJS({
    holder,
    tools: {
      image: { class: ImageTool, config: { uploader: createUploads() } },
    },
  });
  await editor.isReady;
  return editor;
}
```

Call `editor.save()` to obtain document data and `editor.destroy()` on removal.
ImageTool owns its upload notification and authoring UI. Its three alt states
remain distinct: absent means unset, a nonblank string describes the image, and
`''` marks it decorative. Caption is independent. JSON-compatible file metadata
survives mapping, saving and reloading; explicitly retain needed fields in your
backend mapper. The adapter neither authors alt text nor replaces captions.

Upstream ImageTool attempts to preview a pasted source URL independently of this
adapter, before upload settles. If arbitrary remote image loads must be prevented,
the editor host must enforce an appropriate Content-Security-Policy `img-src`
allowlist (for example, `'self' data: blob:` for same-origin assets and local
previews). Backend URL-ingest restrictions alone do not prevent this browser
preview. Allow only the asset origins your host deliberately trusts.

## Request and decoder options

`createFetchFileUploader(options)` returns `FileUploader<Blob, F, E>`;
`createFetchUrlUploader(options)` returns `UrlUploader<F, E>`. Each exposes only
its supported method. Use core `composeImageUploader` when a tool needs both.
An unsupported URL workflow must be deliberately denied by a host port, not left
as an absent method on an ImageTool configuration.

- `request(input)` is required and synchronous. Return a `FetchUploadRequest`
  containing `url: string | URL`, optional `init: RequestInit`, and optional
  `timeoutMs`. Endpoints, methods, headers, credentials, body and host signal are
  entirely host-selected. Create a fresh body per call; Request objects are not
  accepted. A builder throw rejects unchanged. Empty/invalid configuration throws
  `TypeError`; invalid per-call request options reject before Fetch.
- `decode(body, context)` is required and may be asynchronous. JSON is supplied
  as `unknown`; validate your backend schema. Context exposes status, ok and
  response headers. Return the existing `UploadResponse<F, E>`. Successful file
  metadata is copied/validated through core normalization and needs a nonblank
  string URL. Invalid envelope, non-JSON metadata or blank URL rejects. This is
  shape validation, not URL authorization or a safe-protocol guarantee. Expected
  failure/error values retain identity; only success metadata is JSON-normalized.
- Optional `fetch` injects a Fetch-compatible function. It is captured at factory
  creation and called with the options object as receiver, as are request/decode.
  Bind a method first if it belongs to a different service. Otherwise native
  `globalThis.fetch` is looked up at invocation, preserving its receiver.
- `decodeHttpErrors` defaults to false: non-2xx rejects before reading its body.
  Set true only to explicitly map your known non-2xx JSON into `success: 0`.
  Mapping a non-2xx response to success is always rejected. Redirect handling,
  CORS and credentials follow Fetch and your `RequestInit`; use `redirect: 'error'`
  where your host policy forbids redirects.

Options callbacks are captured at construction. Captured host objects and closure
state remain host-owned; create independent request policy for each editor where
needed. Request calls do not serialize concurrent uploads or share controllers.

## Failure, cancellation and timeout

Direct port callers receive expected `success: 0` values and must handle rejected
promises separately. `FetchUploadError` extends Error with `code` and optional
HTTP `status`; `cause` can contain the original exception. Messages omit endpoint,
response body and credentials. Treat causes and backend error payloads as private
unless explicitly redacted for presentation.

| Code          | Meaning                                                                      |
| ------------- | ---------------------------------------------------------------------------- |
| `http`        | Non-2xx, including authorization denial, without explicit error decoding.    |
| `network`     | Fetch rejected; browsers may conceal DNS, CORS and other details.            |
| `response`    | Invalid Fetch response or failed JSON consumption, including malformed JSON. |
| `mapping`     | Decoder throw/rejection or invalid mapped result/metadata.                   |
| `cancelled`   | Host signal was already aborted or aborted during the invocation.            |
| `timeout`     | Host-selected deadline expired.                                              |
| `unsupported` | Fetch or AbortController is unavailable at invocation.                       |

A deadline is a positive integer up to 2,147,483,647 ms; omitted means no timeout.
It starts after synchronous request construction and covers Fetch, body consumption
and decoder waiting. JavaScript timers cannot interrupt synchronous blocking code.
Each call owns a controller and removes its timer/host listener on settlement.
Abort/timeout rejects promptly even if an injected function ignores the signal;
its late settlement is observed, and later decoding is suppressed. Uncooperative
host work can retain resources until it settles. Decoder work already started
cannot be undone. The adapter aborts its local controller when settling to release
unread response resources too.

To cancel, put the intended owner's AbortSignal in `request().init.signal` and
abort that owner. Sharing a signal deliberately cancels every invocation using it.
Transport abort **does not prove remote storage stopped or was rolled back**.
Core operation `stop()` alone is logical cancellation; connect a host signal
explicitly if transport abort is also wanted. No upload-byte progress is provided.

## Opt-in replay-safe retry

There are no implicit retries, including for 429, 500, network failure or timeout.
Attempt counts describe adapter invocations; lower-level browser/proxy connection
replays are outside this adapter’s control. A lost response can follow successful storage. Use core retry only with a backend
that atomically deduplicates a stable operation key, binds it to the authorized
principal and payload, rejects key/payload conflicts and retains the outcome.
The same operation uses the same key and bytes; every new operation needs a new
key. A header alone does not make a backend idempotent.

<!-- upload-example-file: retry.ts -->

```ts
import { createUploadOperation } from '@anarchitects/editorjs-core';
import {
  createFetchFileUploader,
  FetchUploadError,
} from '@anarchitects/editorjs-upload-fetch/browser';
import { decodeAsset } from './uploads.js';

export function uploadWithVerifiedIdempotency(blob: Blob, operationId: string) {
  const uploader = createFetchFileUploader({
    request(input) {
      const body = new FormData();
      body.append('image', input, 'upload.bin');
      return {
        url: '/api/idempotent-assets',
        timeoutMs: 30_000,
        init: {
          method: 'POST',
          body,
          headers: { 'Idempotency-Key': operationId },
        },
      };
    },
    decode: decodeAsset,
  });
  return createUploadOperation(() => uploader.uploadByFile(blob), {
    retry: {
      replaySafe: true,
      maxAttempts: 2,
      delayMs: 100,
      shouldRetry: (outcome) =>
        outcome.kind === 'exception' &&
        outcome.error instanceof FetchUploadError &&
        outcome.error.code === 'network',
      schedule(resume, delay) {
        const timer = setTimeout(resume, delay);
        return () => clearTimeout(timer);
      },
    },
  });
}
```

This classifier is host policy for that verified backend, not a universal network
retry recommendation. Keep retry off when replay safety is unknown. A fresh key
inside `request()` defeats deduplication; a permanent key on a shared uploader
mixes unrelated uploads.

## Public exports and troubleshooting

For an optional backend, the [bounded Nest upload example](./nest-example.md)
includes complete server and browser code for Nest 12.3.2 with Fastify or native
Node. It demonstrates authorization seams, file and URL policy, size limits,
error mapping and duplicate protection using controlled local data. Nest and
storage remain application dependencies; see the example's production limits
before adapting it to a deployed service.

`/browser` exports `createFetchFileUploader`, `createFetchUrlUploader`,
`FetchUploadError`, and the types `FetchUploadErrorCode`, `FetchUploadOptions`,
`FetchUploadRequest`, `FetchUploadResponseContext`. `./package.json` is exported.
Only core is a runtime dependency; the optional ImageTool integration is separate.

For 401/403 verify server authorization and configured credentials. For CORS
failures configure the backend's allowed origins/credentials; Fetch cannot bypass
browser policy. For multipart rejection check the field name and omit the
Content-Type header. For `response` check that the endpoint returns JSON rather
than an HTML sign-in page. For `mapping` validate the actual response schema and
retain only supported JSON metadata. A timeout may follow a committed upload:
reconcile with your backend before retrying blindly.

The host owns authentication, CSRF/CORS policy, upload/body limits, content
inspection, quotas, storage keys, durable storage, cleanup, public URL lifetime,
and error redaction. Never trust a client filename as a storage path. A URL ingest
backend also needs its own destination/redirect/DNS/network restrictions and
resource bounds; this package does not provide a remote-fetch proxy or storage
service. Fetch does not run Angular HttpClient interceptors.

See the [Fetch standard](https://fetch.spec.whatwg.org/#fetch-method) for transport
semantics. Report reproducible problems through
[GitHub issues](https://github.com/anarchitects/anarchitecture-community/issues),
with package/browser versions and redacted request/response details.
