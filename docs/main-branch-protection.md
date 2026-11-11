# Main branch protection and CI contract

Reviewed for [#696](https://github.com/anarchitects/anarchitecture-community/issues/696)
on 6 November 2026 against merged commit
`3c2ef2900c897a68c33e7eb298e599817c778d2c` (#707). This is a dated settings
reconciliation, not a claim that CI passed on a later candidate.

## Outcome

**Retain the current settings.** The required context `main`, bound to GitHub
Actions app ID `15368`, now matches the fail-closed aggregate delivered by #695
and #679. There are no obsolete, duplicate or unattainable required contexts to
remove and no missing workload contexts to add: the aggregate enforces those
outcomes itself. The settings diff is empty; no settings write was necessary or
performed. A second read confirmed the effective configuration was unchanged.

This conclusion follows inspection of live protection, not documentation alone.
The [API evidence](evidence/main-protection-2026-11-06.json) records both observation
times, the exact rule values, repository permissions, app identities and read-back
result. Settings are mutable; repeat the review after changing check names,
workflow triggers, aggregate dependencies, bypasses or merge strategy.

## #720 follow-up: PR admission (10 November 2026)

A bounded read of ruleset `14374927`, the ruleset inventory including parents,
effective `main` rules and repository merge options confirmed the same required
`main` context (GitHub Actions App `15368`), strict checking, signed commits and
squash-only PR rule. No settings were changed or CI results inspected. #720 adds
policy validation to `selection`, already required by the aggregate, and adds PR
metadata edits to workflow triggers so prospective squash-message edits revalidate.
Product selection and the aggregate dependencies remain unchanged.

The repository currently defaults to `COMMIT_OR_PR_TITLE` and `COMMIT_MESSAGES`
for squash messages. These defaults do **not** guarantee the checked PR title/body
becomes the final commit. Maintainers must select the validated message; #722 must
review alignment of those settings, and #721 must validate actual integrated
release intent. The [version policy guide](release-version-policy.md) records this
limitation. A green prospective-message check is not proof of the final message.

## Architecture and authority

The preflight enumerated and read all 24 Meta ADRs at
`09d4fc898ad49c177e3e4bbd6b6be160896262cc` and all nine repository ADRs, including
proposed and historical records. Contributor guidance and Meta's SDLC were also
reviewed. No runtime, package support or release configuration is changed.

- Meta 0004/0016 assign repository workflow implementation to this repository
  within accepted ecosystem policy; proposals do not override accepted decisions.
- Meta 0015 requires trustworthy affected selection, preserved required coverage
  and a stable outcome distinguishing intentional skips from failed or missing work.
- Meta 0013 and Community 0007 retain versioning/release gates. Meta 0014 requires
  human handling of dependency merges; Meta 0017 keeps release authority with the
  relevant owner and explicitly does not introduce a universal two-person review.
- Community 0004 places this operational evidence in contributor documentation;
  Community 0005/0006/0008 retain the existing security and compatibility checks.

There is no policy basis in this slice to invent an approval count, broaden bypass
access, remove signatures, enable automerge or change the published support matrix.
No new architecture conflict was identified in retaining the protection contract.

## Effective settings and current-versus-proposed diff

One active repository ruleset applies:
[`main`, ID 14374927](https://github.com/anarchitects/anarchitecture-community/rules/14374927).
It includes `~DEFAULT_BRANCH` with no exclusions; the default branch is `main`.
The inventory including parent rulesets and the effective branch-rules endpoint
both returned this ruleset only. No inherited organization rule was returned.
Classic branch protection returned HTTP 404, `Branch not protected`: that means
no classic rule, **not** an unprotected branch.

| Control                   | Current                                                                                                                                             | Proposed / rationale                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Required check            | `main`, GitHub Actions integration `15368`                                                                                                          | Retain; exact aggregate context and verified app identity. No `CI / main` prefix in the stored context. |
| Up-to-date requirement    | Strict; checks also enforced on branch creation                                                                                                     | Retain.                                                                                                 |
| Pull request              | Required; squash is the only allowed merge method                                                                                                   | Retain.                                                                                                 |
| Approvals                 | 0; code-owner and last-push approval requirements off                                                                                               | Retain the existing policy; do not infer a new reviewer-count requirement.                              |
| Review handling           | Stale dismissal and thread resolution off; dismissal restriction disabled; no required reviewer entries; extra approval for unattributed changes on | Retain all existing values.                                                                             |
| Signatures/history        | Signed commits required; deletion and non-fast-forward updates restricted                                                                           | Retain. No separate linear-history rule was returned.                                                   |
| Bypass                    | Integration `3090882`, `anarchitects-bot`, mode `always`; current caller `never`                                                                    | Retain the existing release-automation exception; do not expand or exercise it.                         |
| Merge queue               | No effective merge-queue rule                                                                                                                       | Retain. CI already handles `merge_group`; enabling a queue needs a separate settings review.            |
| Repository merge options  | Squash, merge and rebase enabled generally                                                                                                          | Retain. The stricter ruleset permits only squash into `main`.                                           |
| Other repository settings | Auto-merge, automatic branch deletion and update-branch option off                                                                                  | Retain.                                                                                                 |

The GitHub connector could read the ruleset but returned 403 for classic
protection and did not support the effective-rules route. The authenticated CLI
successfully read those endpoints and reported repository admin, maintain, push,
triage and pull permissions. No access blocker remained for this review; no claim
of tested write permission follows from an unneeded settings write.

### Existing bypass boundary

Both the organization installation inventory and the public app endpoint resolve
`3090882` to [Anarchitects Bot](https://github.com/apps/anarchitects-bot).
The checked-in [manual release workflow](../.github/workflows/release.yml) creates
an app token using the `ANARCHITECTS_BOT_*` secret references, uses it for checkout
and Nx release, and refuses non-main invocation. No secret values were read.
This records an intended release-automation use for the existing exception;
it does not prove that every use of the app is limited to that workflow.

`always` bypass is broad: protection does not enforce these rules against that
actor. Preserve it while the existing release route depends on the app, with
repository maintainers owning review whenever that route, app access or bypass
scope changes. Do not use it to merge feature work with failing or missing gates.
Removing or narrowing it requires a reviewed replacement release path; retaining
it neither authorizes a release nor certifies release-tag authority under Meta 0017. #76 still owns its release-specific readiness and authorization work.

## CI and failure/skip behavior

The workflow name is `CI`; its aggregate job ID and emitted check name are `main`.
No other checked-in workflow defines that job/check name. It has `if: always()`
and depends on successful selection plus these six workload jobs:

- `editorjs-core-runtime-baseline`
- `better-auth-typeorm-adapter-compatibility`
- `nest-angular-ssr-consumers`
- `nest-angular-ssr-compatibility`
- `editorjs-angular-packed`
- `workspace`

Browser and SSR/renderer checks are mandatory selected stages inside `workspace`.
The coordinator returns failure if any stage fails, is interrupted or cannot start;
later successes cannot mask an earlier failure. Matrix job outcomes remain inputs
to the aggregate. The 89 authoring and 16 renderer atoms and their uncached
completeness gates remain required when their families are selected.

| Situation                                                                     | Required `main` outcome                                     |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Valid plan; every selected job succeeds; every unselected job is skipped      | Success                                                     |
| Selected job fails, is cancelled, is missing or unexpectedly skips            | Failure                                                     |
| Selection fails/is missing, plan is malformed, or dependencies are incomplete | Failure                                                     |
| Workspace browser/SSR/renderer stage fails but a later stage succeeds         | Failure                                                     |
| Root documentation-only change with a valid unaffected plan                   | Success after selection; product jobs intentionally skipped |

There are no workflow-level path filters. PR comparisons validate base/head and
ancestry; unavailable comparisons fall back to the full baseline. Main pushes and
merge-group candidates retain full validation. Changes to CI orchestration also
request the full baseline. Keeping only the aggregate in protection avoids
requiring independent platform checks that are legitimately skipped before runner
allocation. If the workflow is cancelled before `main` can finish, it cannot
supply the required successful check.

GitHub permits binding a required check to a specific app and aggregates applicable
rulesets; see [available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
and [ruleset layering](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets).
The repository's aggregate is responsible for enforcing its stricter selected-job
success/intentional-skip semantics.

## Verification and #680 handoff

The existing `@anarchitecture-community/source:test-ci-selection` target passed
all ten tests on this merged implementation, with cloud access disabled: 29 actual
affected-graph scenarios, full atom inventory, revision validation, failure/skip
rejection, exact workflow dependencies and workspace-stage failure propagation.
The run took 29.8 seconds and was uncached. `--skipSync` avoided the previously
recorded unrelated Nest fixture TypeScript synchronization conflict; no CI behavior
or fixture configuration was changed. No new tests or production code were needed.

The live settings inventory and independent read-back complete G08's protection
reconciliation. The required settings update is a verified no-op, not a missing
permission workaround. Maintainer review of this record remains the #696 delivery
acceptance step.

#680 can use `main` / GitHub Actions `15368` as the final protection contract once
this slice is accepted. It must still obtain green selected checks for its exact
integrated candidate and resolve or explicitly disposition the G07 renderer
remote-cache/DTE exceptions. Local contract tests and live settings do not establish
that hosted candidate evidence. No CI monitoring, hosted-result inspection, rerun,
capacity experiment, merge, publication or protection mutation was performed here.
