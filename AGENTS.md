## Mandatory architecture decision preflight for every AI agent

**Before generating or editing any code**, including scaffolding, templates, tests, migration scripts and examples, enumerate and read **all ADRs** in both `anarchitects/anarchitecture-meta/adr/**` and **all ADRs in this repository** (`adr/**`, `docs/adr/**` and any other ADR locations). Read accepted, proposed, historical and superseded records; apply accepted decisions, respect each status, document relevant constraints and conflicts, and repeat whenever scope changes. Proposals do not override accepted ADRs. When either ADR source is inaccessible, report the blocker rather than claiming a review or proceeding to generate code. Meta: https://github.com/anarchitects/anarchitecture-meta/tree/main/adr.

## Mandatory cross-repository ADR preflight (all code generation)

Before generating, editing, refactoring, migrating, testing or scaffolding **any code** (including templates and examples), **enumerate and read every ADR** in BOTH (1) `anarchitects/anarchitecture-meta/adr/**` and (2) this repository's ADR directories (`adr/**`, `docs/adr/**` and any other ADR locations). This includes accepted, proposed, historical and superseded records; respect their status. Apply accepted ADRs and applicable local refinements; proposals do not silently override accepted decisions. Explicitly identify relevant decisions and conflicts before implementation and repeat the preflight if scope changes. If Meta or local ADRs cannot be accessed, report the blocker, do not claim to have reviewed them, and request access before code generation. Follow existing local architecture and published compatibility contracts until reviewed amendments are accepted.

Meta ADR index: https://github.com/anarchitects/anarchitecture-meta/tree/main/adr

## Mandatory architecture decision review (AI agents)

Before generating, editing or refactoring **any code**, enumerate and read **ALL ADRs in this repository**, including every document in `adr/**`, `docs/adr/**` and any other documented ADR location. Read accepted, proposed, historical and superseded records; apply their status correctly and follow applicable accepted decisions. Then read **all relevant engineering guides** for the affected packages and topics, including the [Modern Angular Engineering Guide](docs/guides/modern-angular/README.md), its [repository application](docs/guides/modern-angular/repository-application.md) and linked topic guides for Angular work. This applies to generated code, templates, examples, tests and migrations. Record applicable decisions and explicit conflicts before implementation; re-check when scope changes. A proposal does not silently override an accepted ADR. Never commit the licensed Modern Angular PDF, extracted text, scans or copied source passages.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

## Ecosystem architecture decisions

For changes affecting HTTP adapters, Nest presentation, SSR or generator defaults, review the applicable cross-repository architecture decisions in [Anarchitecture Meta](https://github.com/anarchitects/anarchitecture-meta/tree/main/adr), especially [HTTP Platform Independence](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0008-http-platform-independence.md) and [Native Node Candidate Default](https://github.com/anarchitects/anarchitecture-meta/blob/main/adr/0009-native-node-candidate-default.md), **as well as all repository ADRs**. Proposed ADRs establish review intent, not currently shipped behavior or automatic authorization to change supported defaults. If Meta is inaccessible, report that explicitly and avoid assuming the policy was reviewed; local ADRs remain authoritative for repository implementation details. Do not silently change existing Fastify behavior or advertised compatibility.
