---
name: monitor-ci
description: troubleshoot ci, workflow, build, test, lint, package validation, docs, example, or release failures in anarchitecture-community. use when a github action, nx target, package build, example validation flow, or release process fails and the task is specifically about diagnosing and fixing that repo while preserving clear public package boundaries and explicit community adapter behavior.
---

# Overview
Use this skill when CI or automation is failing in `anarchitecture-community`.

Inspect these sources first when relevant:

- workflow logs and failed job output
- `README.md`
- affected package `README.md`
- relevant docs or validation notes under `docs/`

## Required workflow
1. Identify the failing workflow, job, package, and Nx target.
2. Reduce the failure to the smallest reproducible command.
3. Fix the root cause while preserving the repo’s public-package and adapter boundaries.
4. Validate with package-manager-prefixed Nx commands.
5. Summarize the root cause, fix, validation, and any package-surface implications.

## Repo-specific checks
- Do not paper over failures by broadening public APIs unnecessarily.
- Keep examples as validation surfaces, not product packages.
- If a fix changes published package behavior, say whether docs and examples also need updates.
