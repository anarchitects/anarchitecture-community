---
name: community-docs-and-examples
description: implement and refine documentation, examples, and package-facing guidance in anarchitecture-community. use when work belongs specifically in the community adapters repo, especially for package readmes, docs/examples, validation notes, public api explanation, adoption guidance, and keeping extracted community packages clear, minimal, and easy to consume.
---

# Overview
Use this skill when the task belongs in `anarchitecture-community` and is primarily about docs, examples, public package guidance, or example/validation surfaces.

Before changing content, inspect these repo files when relevant:

- `README.md`
- package-level `README.md` files
- docs under `docs/`
- validation or example docs tied to the affected package

## Core implementation rules
- Keep public APIs small and explicit.
- Prefer framework adapters over framework leakage.
- Keep examples as validation surfaces, not product packages.
- Explain both easy mode and advanced mode when the package supports both.
- Keep package documentation as the source of truth for package behavior.

## Required workflow
1. Identify the affected package or docs area under `packages/` or `docs/`.
2. Determine whether the task is package docs, example docs, validation docs, or public adoption guidance.
3. Make the smallest change that improves clarity without overstating guarantees.
4. Preserve the repo’s stance that community packages are reusable integrations, not core domain bricks.
5. Summarize the updated audience, package surface, and any follow-up validation needed.

## Output expectations
In the final summary, explicitly report:
- affected package or docs area
- whether package behavior, examples, or only documentation changed
- whether the docs now describe easy mode, advanced mode, and boundaries clearly
