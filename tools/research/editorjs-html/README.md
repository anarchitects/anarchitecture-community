# SI-650.1 renderer research

This is a bounded observation harness for [#681](https://github.com/anarchitects/anarchitecture-community/issues/681),
not a renderer, production test target or complete security audit. Read the
[research report](../../../docs/editorjs-html-research.md) and
[accepted ADR](../../../docs/adr/0008-editorjs-html-rendering.md).

## Retained inputs and evidence

- `consumer.json` / `consumer-lock.json`: disposable npm manifest and exact lock;
  deliberately not workspace `package.json` files or new Nx projects.
- `fixtures.json`: 21 local saved-contract, semantic and adversarial examples.
- `metadata.json`: exact registry version metadata, integrity, release dates and
  repository snapshot indicators from 31 October 2026.
- `probe.mjs`: Node/module/declaration, public neutral validator, browser DOM and
  sanitizer observations. A zero exit means the harness completed, not that
  candidate output passed the accepted renderer policy.
- `results.json`: raw observations; hashes bind the consumer lock and fixtures.
- `npm-audit.json`: dated known-advisory snapshot, not output-safety assurance.

No third-party source/archive or browser binary is committed. The lock identifies
all dependency archives and declared licenses; results hash tested entry/LICENSE
bytes. Only trusted local marker payloads run, with all page requests aborted.
Negative results and unsupported cases are intentionally retained.

## Reproduce

Use the existing workspace install at the report's baseline (Yarn 4.18.0,
TypeScript 6.0.3, esbuild 0.28.2, Playwright 1.64.0) and its installed Chromium.
Use Node 24.22.2 to reproduce the recorded Node behavior. Other versions/platforms
are separate evidence, not a replacement for the recorded result. A full ADR and
applicable guide preflight is required before editing this executable probe.

From the workspace root, create a disposable directory using its **physical**
path (avoid `/tmp` symlink spelling differences in npm lock paths on macOS):

```sh
research_root="$PWD"
research_consumer="$(mktemp -d)"
research_consumer="$(cd "$research_consumer" && pwd -P)"
research_results="$(mktemp -d)"
cp tools/research/editorjs-html/consumer.json "$research_consumer/package.json"
cp tools/research/editorjs-html/consumer-lock.json "$research_consumer/package-lock.json"
(
  cd "$research_consumer"
  npm ci --ignore-scripts --no-audit --no-fund
)
NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true yarn nx exec \
  --projects=@anarchitecture-community/source --excludeTaskDependencies \
  --skipNxCache -- node "$research_root/tools/research/editorjs-html/probe.mjs" \
  "$research_consumer" "$research_results"
```

The Nx wrapper stalled before probe execution on the recorded host. After
stopping only that invocation, the approved local fallback was:

```sh
node "$research_root/tools/research/editorjs-html/probe.mjs" \
  "$research_consumer" "$research_results"
```

The browser requires normal local Chromium launch permission. This work changed
no Nx task/configuration and used no Nx Cloud or CI monitor. Public neutral source
entries are resolved using the repository's existing source condition solely for
fixture conformance; tested third-party engines resolve from the independent
consumer. Generated probe files/bundles remain in temporary directories.

The final snapshot also ran `npm ci` successfully and recorded a fresh advisory
snapshot from that consumer:

```sh
(
  cd "$research_consumer"
  npm audit --json > "$research_results/npm-audit.json"
)
```

Audit is a fresh external-state observation and may differ later. Do not overwrite
committed evidence without updating its date, runtime/dependency identities and
report. Browser output is inspected for 50 ms per rendered fixture; absence of an
observed marker in that window is not proof of safety. The accepted policy and
future #684 corpus are substantially broader than this candidate-comparison probe.
