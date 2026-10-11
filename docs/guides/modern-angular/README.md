# Modern Angular Engineering Guide

Status: accepted engineering policy accompanying the repository's Modern Angular ADR. Reviewed 2026-10-11. Read [repository application](repository-application.md) before applying examples: an installed Nx major is not an Angular runtime version.

This guide translates concepts from Manfred Steyer, _Modern Angular_, 2nd Extended Edition (2024), into original engineering guidance. It is not a replacement for the licensed book. The source PDF, extracted text and illustrations are not distributed. Its fourteen substantive chapters and introductory/end material are accounted for in the [traceability matrix](traceability.md).

## Authority and version boundaries

Three kinds of evidence remain distinct throughout:

- **S — source principle:** a concept supported by the 2024 book, with printed and physical PDF page ranges in the matrix. Historical examples are not current API specifications.
- **V — versioned fact:** current Angular behavior checked against official documentation on 2026-10-11. The API ledger identifies stable, deprecated and version-dependent behavior. The live documentation observed was Angular 22.2; verify the installed minor before adopting a feature.
- **A — architecture decision:** an accepted Anarchitects rule, identified A01–A12 in the ADR. This includes project defaults and restrictions that the book does not prescribe.

Read **all** repository ADRs, including accepted, proposed, historical and superseded records, then relevant guides and package instructions. Reading a proposal does not accept it. Accepted decisions remain binding until an explicit accepted amendment supersedes a named clause. Record unresolved conflicts before implementation; do not silently let this guide override them.

Angular 22+ is the target for new work under the accepted policy, not permission to change dependency versions. Preserve staged Angular 21 releases and existing support ranges. An Angular 20 example workspace needs a separately reviewed migration. Framework-neutral packages remain framework-neutral. The version ledger and local application explain these distinctions.

## Reading paths

| Engineering concern                                          | Required guide                                               | Decision |
| ------------------------------------------------------------ | ------------------------------------------------------------ | -------- |
| Packages, standalone components, public exports              | [Architecture](architecture.md)                              | A01, A02 |
| Injection, six provider patterns, route and HTTP composition | [Providers and routing](providers-routing-http.md)           | A03, A04 |
| State, RxJS, component contracts and queries                 | [Reactivity](reactivity.md)                                  | A05, A06 |
| Signal Forms and control integration                         | [Forms](forms.md)                                            | A07      |
| Templates, deferred views and custom elements                | [Rendering and elements](rendering-elements.md)              | A08      |
| SSR, hydration and builder ownership                         | [SSR and builds](ssr-builds.md)                              | A09      |
| Tests, migrations, release gates                             | [Testing and migration](testing-migration.md)                | A10, A11 |
| Source-to-decision coverage and API evidence                 | [Traceability](traceability.md), [API ledger](api-ledger.md) | A12      |
| Existing decisions, versions and package seams               | [Repository application](repository-application.md)          | All      |

## Applying a rule

For each change, identify the consumer, supported Angular range, state owner, public entry point and affected ADRs. Prefer the smallest local implementation that obeys those constraints. Do not add NgRx, Nx, SSR or a web-component distribution solely because this guide discusses them. Reuse the repository's supported tooling and test runner.

Examples are original, independent educational units using a small editorial domain. They illustrate APIs, not published Anarchitects package contracts. The [validation record](validation.md) specifies exactly which units were compiled or exercised. Adapt naming, layering, styling and error handling to the consuming package; never copy a sample into a framework-neutral domain module.
