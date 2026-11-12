# Commit and package-version policy enforcement

Implemented for [#720](https://github.com/anarchitects/anarchitecture-community/issues/720).
This supplies PR admission and reusable release validators. It does **not** activate
the owner-approved [release controls](release-controls.md): #721 wires the complete
release path and #722 verifies and activates its permissions.

## Version intent

The resolved Nx project graph is the scope authority. The PR title and body form
the prospective squash message. Use exact project names, comma-separated without
spaces when several projects share the same intent. Every changed release project
needs its scope; repository-wide work outside packages may remain unscoped.
Separate released and unreleased package work when one message cannot express
both lifecycles. Package deletions without a graph owner require a reviewed
migration rather than silently falling outside validation.

| Type                                                           | Nx mapping | Effective bump on `0.x` | Effective bump on `1.x` and later |
| -------------------------------------------------------------- | ---------- | ----------------------- | --------------------------------- |
| `feat`                                                         | minor      | patch                   | minor                             |
| `fix`, `perf`, `refactor`, `revert`                            | patch      | patch                   | patch                             |
| `init`, `docs`, `chore`, `style`, `test`, `e2e`, `build`, `ci` | none       | none                    | none                              |
| Breaking notation on an allowed type other than `init`         | major      | minor                   | major                             |

All thirteen types have explicit settings. Unknown types fail validation; old
`release` commits and historical scopes are not rewritten. `init` must be scoped,
non-breaking, and used only before the package has any distribution/tag history.
Internal fixture projects may use `init`; they are not distribution projects.

Use `!` or the `BREAKING CHANGE:` footer. The pinned Nx 23.2.1 parser does not
recognize `BREAKING-CHANGE:`, so admission rejects it with an actionable message.
Compatibility evidence remains necessary: a mistaken `fix` cannot justify a patch
when the reviewed API change is breaking.

Johan clarified on 10 November 2026 that Community keeps Nx's default zero-major
adjustment until an explicit decision to release `1.x`. The setting is now explicit
and tested. Meta0013's requirement to stop using `init` after publication does not
require disabling that adjustment. [Community0007](adr/0007-package-initial-release-and-nx-versioning.md)
records the clarification. On `0.x`, breaking impact requires at least the next
minor, not `1.0.0`; once stable it requires the next major. A transition out of
`0.x` requires a decision referencing the exact candidate version. #721 must
authenticate that decision under the owner's accepted controls; this library
cannot grant authorization from a supplied string.

## Local entry points

Use the workspace's Yarn and Nx installation, Node 24, Git, and Python 3.11 or
later. History commands also require `gh` authentication and access to GitHub and
the relevant public registry. Examples are read-only:

```bash
NX_NO_CLOUD=true yarn nx run @anarchitecture-community/source:validate-release-policy
NX_NO_CLOUD=true yarn nx run @anarchitecture-community/source:test-release-policy
NX_NO_CLOUD=true yarn nx run @anarchitecture-community/source:release-history --projects=editorjs-core
NX_NO_CLOUD=true yarn nx run @anarchitecture-community/source:preview-release-policy --projects=editorjs-core
```

`preview-release-policy` takes explicit Nx project names. Add `--first-release`
only for a selection proven to have no prior distribution history; its sole first
version is `0.0.1`. Existing and unreleased selections cannot be mixed. Expanded
dependents are checked too. Tags must be available locally for Nx's calculation;
the separate fresh remote history does not fetch or change local refs.

The preview calls only Nx's version API with `dryRun` and all Git writes disabled.
It also explicitly disables `preVersionCommand`: the installed Nx executes that
hook even in dry-run mode. It never calls changelog, release creation or publish.
Dependency expansion is retained. A version preview alone is not release readiness
or permission, and it does not validate prepared artifacts.

`validate-commit-policy` consumes GitHub's PR event file, compares the exact head
against its merge base, and requires a complete Git history. It checks the PR
title/body, not every temporary branch commit. Maintainers must preserve the
validated message when squashing; changing the merge message is not automatically
covered by a successful PR check. On 12 November, #722 changed and independently
verified the repository defaults as `PR_TITLE` / `PR_BODY` to match admission.
These defaults do not prevent manual edits to the final message; see the
[dated protection follow-up](main-branch-protection.md).

## Candidate API for #721

`tools/release/workspace.mjs` exports `workspace()`, `identity()`,
`previewVersions()` and `validateCandidate(context, candidate)`. The candidate
contains:

- `project`, `version`, and `tag` (`<project>@<version>`).
- `artifacts`: paths to the prepared npm tarball, Python wheel **and** sdist, or
  dbt distribution directory. The validator reads metadata and computes SHA-256
  itself, without extraction or executing package scripts.
- `nxVersion`: the trusted preparation's `currentVersion` and `newVersion`.
- `compatibility`: `minimumBump` (`none`, `patch`, `minor`, `major`) and a nonempty
  evidence reference. Impact describes the API change; the guard applies the
  configured zero-major adjustment when checking its minimum version.
- `stableTransition`, only when moving from `0.x` to a stable-major line:
  the exact `version` and an `evidence` reference to the owner's explicit decision.

The source manifest, actual artifact identities/versions, tag and Nx result must
agree. First distribution is exactly `0.0.1`; existing version histories remain
intact. An initial `0.0.1` tag created by the approved release handoff does not
invalidate publication of that same version. An additional channel for an
existing version is not a new initial release. A new candidate must advance all
observed history, and its Nx baseline must exist in its distribution channel.
This deliberately blocks advancing past the Governance tag/registry discrepancies
recorded in the [#719 inventory](release-controls-inventory-719.md).

The [#721 execution path](release-execution.md) supplies authenticated Nx results
and compatibility/transition evidence, binds them to the final commit and archives,
checks dependent publication, enforces owner approval, and rechecks publication
state before mutation. Activation remains blocked on #722. The injectable
dependencies in tests are not an authorization mechanism.
Recognizing an existing version does not permit overwriting it: recovery must
compare remote bytes and provenance before publishing any missing channel.
Archive metadata agreement does not replace export, dependency, security,
consumer or compatibility checks. dbt's directory digest identifies its prepared
contents; #721 records and verifies the released Git subdirectory/tree separately.

## Fresh state, failures and coverage

History combines canonical remote Git tags, all non-draft GitHub Releases and
the corresponding npm/PyPI version map. dbt uses Git/GitHub distribution history.
Registry identities are checked. Only a recognized registry 404 means absence;
authentication errors, timeouts, network failures and malformed records fail
closed. Unexpected non-SemVer history also fails for deliberate review rather
than coercion or deletion. The caller must reconcile discrepancies, not reset
history with first-release mode.

Only `test-release-policy` is cacheable: it uses offline fixtures and declares
tool sources, configuration, lockfile and runtime inputs. Configuration, commit,
history and preview targets are uncached. History is never stored as a reusable
authorization result. The tests cover positive/negative scope and lifecycle
cases, malformed/unavailable history, initial/additional-channel versions, actual
archive metadata, compatibility floors and explicit stable transition. Disposable
Git repositories exercise the installed Nx for `0.x`, stable and initial releases,
checking unchanged manifests, index, commits and tags and suppressed build hooks.

CI runs policy tests/configuration in `selection`; PRs additionally run commit
admission. The existing required `main` aggregate fails if selection fails. PR
metadata edits trigger CI so title/body corrections are checked. The affected
product selection and aggregate contract remain unchanged; this does not solve
#712 or #667. No hosting, monitoring or reruns are authorized by these targets.

Direct main pushes, manual registry operations and last-moment squash-message
edits are **not fully enforced by this slice**. #721's staged controllers validate
the integrated candidate and new commits since version preparation, repeating
gates on normal/retry/manual paths. #722 owns access, activation and bypass closure.
Existing release routes are not made safe merely by merging these helpers.

## Architecture preflight

On 10 November 2026, all 24 Meta ADRs at
`770b6d67d7a4479ec0226f0ac48beeb2534db6a2` and all nine Community ADRs were
enumerated and read, including proposed and historical records. CONTRIBUTING,
OWNERSHIP, the local SDLC, release-control design, Governance release guidance
and the CI/protection contract were reviewed.

Meta0013/Community0007 govern scopes, lifecycle, independent versions and history;
Meta0015 keeps fresh external state outside caching; Meta0016–0019 separate
ownership, authorization and delivery status. Community0004 keeps operational
instructions outside consumer READMEs. Existing compatibility/security gates and
cache/DTE exceptions remain unchanged. Proposed governance records do not override
accepted decisions. No accepted ADR requires disabling zero-major behavior; the
initial implementation assumption to that effect was corrected before delivery.
