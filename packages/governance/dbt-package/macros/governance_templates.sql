{% macro anarchitects_governance_as_yaml_bool(value) %}
  {% if value in [true, 'true', 'True', 'TRUE', 'yes', 'Yes', '1', 1] %}
    {{ return('true') }}
  {% endif %}

  {{ return('false') }}
{% endmacro %}

{% macro anarchitects_governance_quote_yaml_string(value) %}
  {% if value is none %}
    {{ return("''") }}
  {% endif %}

  {{ return("'" ~ (value | string | replace("'", "''")) ~ "'") }}
{% endmacro %}

{% macro anarchitects_governance_normalize_layers(layers) %}
  {% if layers is not sequence or layers is string or (layers | length) == 0 %}
    {{ return(['staging', 'intermediate', 'marts']) }}
  {% endif %}

  {% set normalized = [] %}
  {% for layer in layers %}
    {% if layer is string and (layer | trim | length) > 0 %}
      {% do normalized.append(layer | trim) %}
    {% endif %}
  {% endfor %}

  {% if normalized | length == 0 %}
    {{ return(['staging', 'intermediate', 'marts']) }}
  {% endif %}

  {{ return(normalized) }}
{% endmacro %}

{% macro anarchitects_governance_render_metadata_template(
  model_name='fct_orders',
  description='Fact table for order analytics.',
  layer='marts',
  domain='sales',
  owner_team='analytics',
  criticality='high',
  public_interface=true,
  cross_domain_approved=false,
  contract_enforced=true
) %}
  {% set lines = [] %}
  {% do lines.append('models:') %}
  {% do lines.append('  - name: ' ~ model_name) %}
  {% do lines.append('    description: ' ~ anarchitects_governance.anarchitects_governance_quote_yaml_string(description)) %}
  {% do lines.append('    config:') %}
  {% do lines.append('      contract:') %}
  {% do lines.append('        enforced: ' ~ anarchitects_governance.anarchitects_governance_as_yaml_bool(contract_enforced)) %}
  {% do lines.append('    meta:') %}
  {% do lines.append('      anarchitects:') %}
  {% do lines.append('        governance:') %}
  {% do lines.append('          layer: ' ~ layer) %}
  {% do lines.append('          domain: ' ~ domain) %}
  {% do lines.append('          owner:') %}
  {% do lines.append('            team: ' ~ owner_team) %}
  {% do lines.append('          criticality: ' ~ criticality) %}
  {% do lines.append('          publicInterface: ' ~ anarchitects_governance.anarchitects_governance_as_yaml_bool(public_interface)) %}
  {% do lines.append('          crossDomainApproved: ' ~ anarchitects_governance.anarchitects_governance_as_yaml_bool(cross_domain_approved)) %}

  {{ return(lines | join('\n')) }}
{% endmacro %}

{% macro anarchitects_governance_render_profile_template(
  profile_name='dbt',
  layers=none,
  require_ownership=true,
  require_documentation=true
) %}
  {% set normalized_layers = anarchitects_governance.anarchitects_governance_normalize_layers(layers) %}
  {% set lines = [] %}
  {% do lines.append('# Starter Anarchitects governance.profile.yml content') %}
  {% do lines.append('# Mirror this into governance.yml -> profile.document today when using dbt-governance.') %}
  {% do lines.append('name: ' ~ profile_name) %}
  {% do lines.append('layers:') %}
  {% for layer in normalized_layers %}
    {% do lines.append('  - ' ~ layer) %}
  {% endfor %}
  {% do lines.append('allowedDomainDependencies: {}') %}
  {% do lines.append('ownership:') %}
  {% do lines.append('  required: ' ~ anarchitects_governance.anarchitects_governance_as_yaml_bool(require_ownership)) %}
  {% do lines.append('health:') %}
  {% do lines.append('  statusThresholds:') %}
  {% do lines.append('    goodMinScore: 85') %}
  {% do lines.append('    warningMinScore: 70') %}
  {% do lines.append('metrics: {}') %}
  {% do lines.append('rules:') %}
  {% do lines.append('  dbt/no-disallowed-layer-dependency:') %}
  {% do lines.append('    enabled: true') %}
  {% do lines.append('    severity: error') %}
  {% do lines.append('    options:') %}
  {% do lines.append('      allowedUpstreamByLayer:') %}
  {% for idx in range(normalized_layers | length) %}
    {% set layer = normalized_layers[idx] %}
    {% do lines.append('        ' ~ layer ~ ':') %}
    {% for upstream in normalized_layers[: idx + 1] %}
      {% do lines.append('          - ' ~ upstream) %}
    {% endfor %}
  {% endfor %}
  {% do lines.append('  ownership-presence:') %}
  {% do lines.append('    enabled: true') %}
  {% do lines.append('    severity: warning') %}
  {% do lines.append('    options:') %}
  {% do lines.append('      required: ' ~ anarchitects_governance.anarchitects_governance_as_yaml_bool(require_ownership)) %}
  {% do lines.append('  documentation-gap:') %}
  {% do lines.append('    enabled: true') %}
  {% do lines.append('    severity: warning') %}
  {% do lines.append('    options:') %}
  {% do lines.append('      metadataKeys:') %}
  {% do lines.append('        - documentation') %}
  {% do lines.append('      requireAny: ' ~ anarchitects_governance.anarchitects_governance_as_yaml_bool(require_documentation)) %}

  {{ return(lines | join('\n')) }}
{% endmacro %}
