{% macro anarchitects_governance_test_pass_sql() %}
select 1 as validation_error
where 1 = 0
{% endmacro %}

{% macro anarchitects_governance_test_fail_sql(message='governance metadata validation failed') %}
select '{{ message | replace("'", "''") }}' as validation_error
{% endmacro %}

{% macro anarchitects_governance_normalize_string(value) %}
  {% if value is string %}
    {{ return(value | trim | lower) }}
  {% endif %}

  {{ return(none) }}
{% endmacro %}

{% macro anarchitects_governance_is_non_empty_string(value) %}
  {{ return(value is string and (value | trim | length) > 0) }}
{% endmacro %}

{% macro anarchitects_governance_get_target_relation_name(model) %}
  {{ return(model | string | trim) }}
{% endmacro %}

{% macro anarchitects_governance_get_target_identifier(model) %}
  {% if model.identifier is defined %}
    {{ return(model.identifier | string | trim) }}
  {% endif %}

  {{ return(none) }}
{% endmacro %}

{% macro anarchitects_governance_get_target_schema(model) %}
  {% if model.schema is defined %}
    {{ return(model.schema | string | trim) }}
  {% endif %}

  {{ return(none) }}
{% endmacro %}

{% macro anarchitects_governance_get_target_database(model) %}
  {% if model.database is defined %}
    {{ return(model.database | string | trim) }}
  {% endif %}

  {{ return(none) }}
{% endmacro %}

{% macro anarchitects_governance_node_matches_relation(
  node,
  target_relation_name,
  target_identifier,
  target_schema,
  target_database
) %}
  {% if node.relation_name is defined
    and node.relation_name
    and node.relation_name | string | trim == target_relation_name %}
    {{ return(true) }}
  {% endif %}

  {% if not target_identifier %}
    {{ return(false) }}
  {% endif %}

  {% set node_identifier = none %}
  {% if node.alias is defined and node.alias %}
    {% set node_identifier = node.alias | string | trim %}
  {% elif node.name is defined and node.name %}
    {% set node_identifier = node.name | string | trim %}
  {% endif %}

  {% if node_identifier != target_identifier %}
    {{ return(false) }}
  {% endif %}

  {% if target_schema and node.schema is defined and node.schema %}
    {% if node.schema | string | trim != target_schema %}
      {{ return(false) }}
    {% endif %}
  {% endif %}

  {% if target_database and node.database is defined and node.database %}
    {% if node.database | string | trim != target_database %}
      {{ return(false) }}
    {% endif %}
  {% endif %}

  {{ return(true) }}
{% endmacro %}

{% macro anarchitects_governance_find_target_node(model) %}
  {% if not execute %}
    {{ return(none) }}
  {% endif %}

  {% set target_relation_name = anarchitects_governance.anarchitects_governance_get_target_relation_name(model) %}
  {% set target_identifier = anarchitects_governance.anarchitects_governance_get_target_identifier(model) %}
  {% set target_schema = anarchitects_governance.anarchitects_governance_get_target_schema(model) %}
  {% set target_database = anarchitects_governance.anarchitects_governance_get_target_database(model) %}

  {% for node in graph.nodes.values() %}
    {% if node.resource_type in ['model', 'seed', 'snapshot']
      and anarchitects_governance.anarchitects_governance_node_matches_relation(
        node,
        target_relation_name,
        target_identifier,
        target_schema,
        target_database
      ) %}
      {{ return(node) }}
    {% endif %}
  {% endfor %}

  {% if graph.sources is defined %}
    {% for node in graph.sources.values() %}
      {% if anarchitects_governance.anarchitects_governance_node_matches_relation(
        node,
        target_relation_name,
        target_identifier,
        target_schema,
        target_database
      ) %}
        {{ return(node) }}
      {% endif %}
    {% endfor %}
  {% endif %}

  {{ return(none) }}
{% endmacro %}

{% macro anarchitects_governance_get_governance_meta(model) %}
  {% set node = anarchitects_governance.anarchitects_governance_find_target_node(model) %}
  {% if not node %}
    {{ return(none) }}
  {% endif %}

  {% set meta = node.meta if node.meta is defined and node.meta is mapping else {} %}
  {% set anarchitects = meta.anarchitects if meta.anarchitects is defined and meta.anarchitects is mapping else {} %}
  {% set governance = anarchitects.governance if anarchitects.governance is defined and anarchitects.governance is mapping else {} %}

  {{ return(governance) }}
{% endmacro %}

{% macro anarchitects_governance_get_governance_value(model, key_path) %}
  {% set governance = anarchitects_governance.anarchitects_governance_get_governance_meta(model) %}
  {% if governance is none %}
    {{ return(none) }}
  {% endif %}

  {% set ns = namespace(current=governance) %}
  {% for segment in key_path %}
    {% if ns.current is mapping and segment in ns.current %}
      {% set ns.current = ns.current[segment] %}
    {% else %}
      {{ return(none) }}
    {% endif %}
  {% endfor %}

  {{ return(ns.current) }}
{% endmacro %}

{% macro anarchitects_governance_normalize_allowed_values(values) %}
  {% set normalized = [] %}

  {% for value in values or [] %}
    {% set normalized_value = anarchitects_governance.anarchitects_governance_normalize_string(value) %}
    {% if normalized_value %}
      {% do normalized.append(normalized_value) %}
    {% endif %}
  {% endfor %}

  {{ return(normalized) }}
{% endmacro %}

{% macro anarchitects_governance_get_description(model) %}
  {% set node = anarchitects_governance.anarchitects_governance_find_target_node(model) %}
  {% if node and node.description is defined %}
    {{ return(node.description) }}
  {% endif %}

  {{ return(none) }}
{% endmacro %}

{% test has_governance_layer(model) %}
  {% set layer = anarchitects_governance.anarchitects_governance_get_governance_value(model, ['layer']) %}

  {% if anarchitects_governance.anarchitects_governance_is_non_empty_string(layer) %}
    {{ anarchitects_governance.anarchitects_governance_test_pass_sql() }}
  {% elif execute %}
    {{ anarchitects_governance.anarchitects_governance_test_fail_sql('Missing meta.anarchitects.governance.layer') }}
  {% else %}
    {{ anarchitects_governance.anarchitects_governance_test_pass_sql() }}
  {% endif %}
{% endtest %}

{% test has_governance_domain(model) %}
  {% set domain = anarchitects_governance.anarchitects_governance_get_governance_value(model, ['domain']) %}

  {% if anarchitects_governance.anarchitects_governance_is_non_empty_string(domain) %}
    {{ anarchitects_governance.anarchitects_governance_test_pass_sql() }}
  {% elif execute %}
    {{ anarchitects_governance.anarchitects_governance_test_fail_sql('Missing meta.anarchitects.governance.domain') }}
  {% else %}
    {{ anarchitects_governance.anarchitects_governance_test_pass_sql() }}
  {% endif %}
{% endtest %}

{% test has_governance_owner(model) %}
  {% set owner_team = anarchitects_governance.anarchitects_governance_get_governance_value(model, ['owner', 'team']) %}

  {% if anarchitects_governance.anarchitects_governance_is_non_empty_string(owner_team) %}
    {{ anarchitects_governance.anarchitects_governance_test_pass_sql() }}
  {% elif execute %}
    {{ anarchitects_governance.anarchitects_governance_test_fail_sql('Missing meta.anarchitects.governance.owner.team') }}
  {% else %}
    {{ anarchitects_governance.anarchitects_governance_test_pass_sql() }}
  {% endif %}
{% endtest %}

{% test has_governance_criticality(model) %}
  {% set criticality = anarchitects_governance.anarchitects_governance_get_governance_value(model, ['criticality']) %}

  {% if anarchitects_governance.anarchitects_governance_is_non_empty_string(criticality) %}
    {{ anarchitects_governance.anarchitects_governance_test_pass_sql() }}
  {% elif execute %}
    {{ anarchitects_governance.anarchitects_governance_test_fail_sql('Missing meta.anarchitects.governance.criticality') }}
  {% else %}
    {{ anarchitects_governance.anarchitects_governance_test_pass_sql() }}
  {% endif %}
{% endtest %}

{% test has_allowed_governance_layer(model, allowed_layers) %}
  {% set allowed = anarchitects_governance.anarchitects_governance_normalize_allowed_values(allowed_layers) %}
  {% set layer = anarchitects_governance.anarchitects_governance_get_governance_value(model, ['layer']) %}
  {% set normalized_layer = anarchitects_governance.anarchitects_governance_normalize_string(layer) %}

  {% if not execute %}
    {{ anarchitects_governance.anarchitects_governance_test_pass_sql() }}
  {% elif allowed | length == 0 %}
    {{ anarchitects_governance.anarchitects_governance_test_fail_sql('has_allowed_governance_layer requires at least one allowed layer') }}
  {% elif not normalized_layer %}
    {{ anarchitects_governance.anarchitects_governance_test_fail_sql('Missing meta.anarchitects.governance.layer') }}
  {% elif normalized_layer in allowed %}
    {{ anarchitects_governance.anarchitects_governance_test_pass_sql() }}
  {% else %}
    {{ anarchitects_governance.anarchitects_governance_test_fail_sql('meta.anarchitects.governance.layer is not in the configured allowed_layers set') }}
  {% endif %}
{% endtest %}

{% test has_allowed_criticality(model, allowed_values, required=false) %}
  {% set allowed = anarchitects_governance.anarchitects_governance_normalize_allowed_values(allowed_values) %}
  {% set criticality = anarchitects_governance.anarchitects_governance_get_governance_value(model, ['criticality']) %}
  {% set normalized_criticality = anarchitects_governance.anarchitects_governance_normalize_string(criticality) %}

  {% if not execute %}
    {{ anarchitects_governance.anarchitects_governance_test_pass_sql() }}
  {% elif allowed | length == 0 %}
    {{ anarchitects_governance.anarchitects_governance_test_fail_sql('has_allowed_criticality requires at least one allowed value') }}
  {% elif not normalized_criticality and not required %}
    {{ anarchitects_governance.anarchitects_governance_test_pass_sql() }}
  {% elif not normalized_criticality and required %}
    {{ anarchitects_governance.anarchitects_governance_test_fail_sql('Missing required meta.anarchitects.governance.criticality') }}
  {% elif normalized_criticality in allowed %}
    {{ anarchitects_governance.anarchitects_governance_test_pass_sql() }}
  {% else %}
    {{ anarchitects_governance.anarchitects_governance_test_fail_sql('meta.anarchitects.governance.criticality is not in the configured allowed_values set') }}
  {% endif %}
{% endtest %}
