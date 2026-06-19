{% macro anarchitects_governance_collect_validation_resources() %}
  {% set resources = [] %}

  {% for node in graph.nodes.values() %}
    {% if node.package_name != 'anarchitects_governance'
      and node.resource_type in ['model', 'seed', 'snapshot'] %}
      {% do resources.append(node) %}
    {% endif %}
  {% endfor %}

  {% if graph.sources is defined %}
    {% for node in graph.sources.values() %}
      {% if node.package_name != 'anarchitects_governance' %}
        {% do resources.append(node) %}
      {% endif %}
    {% endfor %}
  {% endif %}

  {{ return(resources) }}
{% endmacro %}

{% macro anarchitects_governance_get_node_governance_meta(node) %}
  {% set meta = node.meta if node.meta is defined and node.meta is mapping else {} %}
  {% if meta == {} and node.config is defined and node.config is mapping and node.config.meta is defined and node.config.meta is mapping %}
    {% set meta = node.config.meta %}
  {% endif %}
  {% set anarchitects = meta.anarchitects if meta.anarchitects is defined and meta.anarchitects is mapping else {} %}
  {% set governance = anarchitects.governance if anarchitects.governance is defined and anarchitects.governance is mapping else {} %}

  {{ return(governance) }}
{% endmacro %}

{% macro anarchitects_governance_resource_label(node) %}
  {% if node.resource_type == 'source' and node.source_name is defined %}
    {{ return(node.resource_type ~ ' ' ~ node.source_name ~ '.' ~ node.name) }}
  {% endif %}

  {{ return(node.resource_type ~ ' ' ~ node.name) }}
{% endmacro %}

{% macro anarchitects_governance_required_fields(required=none) %}
  {% if required is sequence and required is not string and (required | length) > 0 %}
    {{ return(required) }}
  {% endif %}

  {{ return(['layer', 'domain', 'owner']) }}
{% endmacro %}

{% macro governance_validate_metadata(
  allowed_layers=none,
  allowed_criticality_values=none,
  required=none,
  fail_on_error=false
) %}
  {% if not execute %}
    {{ log('governance_validate_metadata only inspects graph metadata during execution time.', info=True) }}
    {{ return({'checked': 0, 'errors': 0}) }}
  {% endif %}

  {% set resources = anarchitects_governance.anarchitects_governance_collect_validation_resources() %}
  {% set required_fields = anarchitects_governance.anarchitects_governance_required_fields(required) %}
  {% set normalized_allowed_layers = anarchitects_governance.anarchitects_governance_normalize_allowed_values(allowed_layers) %}
  {% set normalized_allowed_criticality = anarchitects_governance.anarchitects_governance_normalize_allowed_values(allowed_criticality_values) %}
  {% set errors = [] %}

  {% for node in resources %}
    {% set governance = anarchitects_governance.anarchitects_governance_get_node_governance_meta(node) %}
    {% set label = anarchitects_governance.anarchitects_governance_resource_label(node) %}

    {% set layer = governance.layer if governance is mapping and governance.layer is defined else none %}
    {% set domain = governance.domain if governance is mapping and governance.domain is defined else none %}
    {% set criticality = governance.criticality if governance is mapping and governance.criticality is defined else none %}
    {% set owner = governance.owner if governance is mapping and governance.owner is defined and governance.owner is mapping else {} %}
    {% set owner_team = owner.team if owner is mapping and owner.team is defined else none %}
    {% set normalized_layer = anarchitects_governance.anarchitects_governance_normalize_string(layer) %}
    {% set normalized_criticality = anarchitects_governance.anarchitects_governance_normalize_string(criticality) %}

    {% if 'layer' in required_fields and not anarchitects_governance.anarchitects_governance_is_non_empty_string(layer) %}
      {% do errors.append(label ~ ': missing meta.anarchitects.governance.layer') %}
    {% endif %}

    {% if 'domain' in required_fields and not anarchitects_governance.anarchitects_governance_is_non_empty_string(domain) %}
      {% do errors.append(label ~ ': missing meta.anarchitects.governance.domain') %}
    {% endif %}

    {% if 'owner' in required_fields and not anarchitects_governance.anarchitects_governance_is_non_empty_string(owner_team) %}
      {% do errors.append(label ~ ': missing meta.anarchitects.governance.owner.team') %}
    {% endif %}

    {% if normalized_allowed_layers | length > 0 and normalized_layer and normalized_layer not in normalized_allowed_layers %}
      {% do errors.append(label ~ ': invalid governance layer "' ~ layer ~ '"') %}
    {% endif %}

    {% if 'criticality' in required_fields and not anarchitects_governance.anarchitects_governance_is_non_empty_string(criticality) %}
      {% do errors.append(label ~ ': missing meta.anarchitects.governance.criticality') %}
    {% endif %}

    {% if normalized_allowed_criticality | length > 0 and normalized_criticality and normalized_criticality not in normalized_allowed_criticality %}
      {% do errors.append(label ~ ': invalid governance criticality "' ~ criticality ~ '"') %}
    {% endif %}
  {% endfor %}

  {% if errors | length == 0 %}
    {{ log('governance_validate_metadata: no metadata issues found across ' ~ (resources | length) ~ ' resources.', info=True) }}
  {% else %}
    {{ log('governance_validate_metadata: found ' ~ (errors | length) ~ ' metadata issue(s).', info=True) }}
    {% for error in errors %}
      {{ log('  - ' ~ error, info=True) }}
    {% endfor %}
  {% endif %}

  {% if fail_on_error and errors | length > 0 %}
    {{ exceptions.raise_compiler_error('governance_validate_metadata found ' ~ (errors | length) ~ ' metadata issue(s).') }}
  {% endif %}

  {{ return({'checked': resources | length, 'errors': errors | length}) }}
{% endmacro %}
