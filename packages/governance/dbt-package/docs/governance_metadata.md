{% docs anarchitects_governance_metadata %}
Anarchitects governance metadata is the recommended dbt-side convention for describing layer, domain, ownership, criticality, and interface intent inside a dbt project.

Use the nested `meta.anarchitects.governance` namespace for new projects so metadata stays explicit and consistent. The companion package also provides lightweight generic tests for early metadata feedback, but those tests do not replace `dbt-governance check`.
{% enddocs %}

{% docs anarchitects_governance_layer %}
The governance layer identifies where a resource sits in the intended dbt architecture, for example `staging`, `intermediate`, or `marts`.

This is an Anarchitects governance convention, not a dbt default. Keep layer values consistent across the project so downstream evaluation can reason about lineage boundaries clearly.
{% enddocs %}

{% docs anarchitects_governance_domain %}
The governance domain identifies the accountable business or data domain for a resource, for example `sales`, `finance`, or `customer`.

Use a stable domain vocabulary across related models, sources, and marts so cross-domain dependencies remain explicit.
{% enddocs %}

{% docs anarchitects_governance_owner %}
The recommended ownership field is `meta.anarchitects.governance.owner.team`.

Use it to record the accountable team for a resource. Keep the team name consistent with the rest of your governance and operating model.
{% enddocs %}

{% docs anarchitects_governance_criticality %}
Criticality marks how important or sensitive a dbt resource is from a governance perspective, for example `high` or `critical`.

Use it consistently when a resource requires stronger expectations around ownership, testing, or documentation.
{% enddocs %}

{% docs anarchitects_governance_public_interface %}
`publicInterface` marks a resource that is intended to act as a public or governed interface for downstream consumers.

Use this flag when you want to distinguish internally useful transformations from published interfaces that should remain especially well documented and stable.
{% enddocs %}

{% docs anarchitects_governance_documentation %}
dbt `description` remains the primary dbt-native documentation signal for governance.

The companion package helps document the convention, but writing clear descriptions on governed resources is still the project's responsibility.
{% enddocs %}

{% docs anarchitects_governance_cross_domain_approval %}
`crossDomainApproved` is the recommended metadata marker for intentional cross-domain usage.

Use it to document approval intent in project metadata. Follow-up runtime work is still required before the full nested convention is interpreted end to end by `dbt-governance check`.
{% enddocs %}

{% docs anarchitects_governance_contracts %}
`config.contract.enforced` is the recommended dbt-native contract signal for governed models where dbt contracts apply.

This package documents the expectation and provides helper templates, but it does not enforce contracts or run governance evaluation itself.
{% enddocs %}

{% docs anarchitects_governance_runtime_boundary %}
The companion dbt package lives inside a dbt project and helps with metadata, docs, and helper macros.

`dbt-governance` remains outside dbt as the authoritative evaluation and reporting path. Installing this package with `dbt deps` does not install the Python CLI or Node runtime, and the package's generic tests only inspect local dbt metadata rather than performing full governance evaluation.
{% enddocs %}

{% docs anarchitects_governance_generic_tests %}
The companion package includes lightweight generic tests such as `has_governance_layer`, `has_governance_domain`, `has_governance_owner`, `has_allowed_governance_layer`, and `has_allowed_criticality`.

These tests use dbt graph metadata inspection during test execution to provide early developer feedback about the recommended `meta.anarchitects.governance` convention. They do not evaluate graph-level policies such as lineage boundaries or cross-domain dependency rules.
{% enddocs %}
