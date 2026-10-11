# Validation record and reproduction

Verified 2026-10-11. The source review covered all 146 PDF pages and the 41 embedded figure instances (including repeated/end-matter images). No source PDF, extracts, scans or figures are committed. The chapter matrix is original analysis, and every example was independently written for this guide.

## Executed checks

- Official API review and all 42 distinct angular.dev links: HTTP 200, with no not-found page reported.
- Isolated Angular CLI production build of the four complete example units: passed on Angular/core/CLI/build/compiler-cli 22.2.2, TypeScript 6.0.3, RxJS 7.8.2, Node 24.21.0.
- Vitest 5.0.3 with jsdom 30.1.2: **10 tests passed**. The [original verification suite](validation-suite.md) is included for reproduction.
- Behavior covered: callable DI policy, optional feature selection and duplicate rejection, per-owner initializer cleanup, parent service chains/fallback, immutable state/isolation, custom FormValueControl interaction/validation/touch/reset, FormRoot native-default prevention, duplicate asynchronous submission/server errors, and child/parent HTTP interceptor order versus root-service resolution.
- Repository checks: Markdown formatting/lint, changed-file relative links/anchors, whitespace diff checks, documentation-only file scope and absence of licensed artifacts. See the PR's final check status for hosted CI.

The first sandboxed build terminated in an esbuild process deadlock; the same build succeeded in the permitted local execution environment. No example API repair was needed to obtain the passing build/tests. Repository manifests and lockfiles were not changed.

## Limits of this evidence

These checks validate the documented units, not every existing package. Full builds/tests of all eleven repositories, real-browser Angular Elements integration, route-reuse behavior, deferred chunk failures, SSR/hydration and packed Angular 21/22 consumer matrices were **not** run for this documentation-only change. Those checks remain implementation/release gates wherever the corresponding feature is used. Current 22.2 evidence is not a compatibility guarantee for all 22.x or Angular 21 consumers.

The form test proves attached directive behavior and a POST method; it is not a browser-level proof of a production host's pre-hydration POST/Enter behavior. No package release or dependency migration is performed. API links are live and should be revalidated when the supported minor changes.

## Reproduce the complete example checks

Run from this repository's root with a supported Node version, Python 3 and npm. The commands generate a disposable external workspace and require registry access. They do not install dependencies into this repository. The temporary lockfile should be retained when comparing later test runs.

````sh
export GUIDE_SOURCE="$PWD/docs/guides/modern-angular"
cd "$(mktemp -d)"
npx --yes @angular/cli@22.2.2 new guide-validation --skip-git --skip-install --defaults --style css --ssr false
cd guide-validation
python3 - <<'PY'
import json, os, re
from pathlib import Path
source = Path(os.environ['GUIDE_SOURCE'])
target = Path('src/app')
for document in source.glob('*.md'):
    for name, code in re.findall(
        r'<!-- example-file: (.*?) -->\s*```ts\n(.*?)\n```',
        document.read_text(), re.S
    ):
        (target / name).write_text(code + '\n')
(target / 'app.spec.ts').unlink(missing_ok=True)
(target / 'app.ts').write_text('''import { Component } from '@angular/core';
import { ReviewForm } from './editorial-form';
@Component({selector: 'app-root', imports: [ReviewForm], template: '<editorial-review-form />'})
export class App {}
''')
package = json.loads(Path('package.json').read_text())
pins = {'typescript': '6.0.3', 'rxjs': '7.8.2', 'vitest': '5.0.3', 'jsdom': '30.1.2'}
for group in ('dependencies', 'devDependencies'):
    for name in package[group]:
        if name.startswith('@angular/'):
            package[group][name] = '22.2.2'
        elif name in pins:
            package[group][name] = pins[name]
Path('package.json').write_text(json.dumps(package, indent=2) + '\n')
PY
npm install
npm run build
npm test -- --watch=false
````

All complete TypeScript examples carry an `example-file` marker. Short inline API expressions and the illustrative directory tree are explanatory fragments rather than standalone build units. Preserve that distinction when adding examples.
