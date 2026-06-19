{% macro governance_metadata_template() %}
  {%- set template -%}
meta:
  anarchitects:
    governance:
      layer: marts
      domain: sales
      owner:
        team: analytics
      criticality: high
      publicInterface: true
      crossDomainApproved: false
  {%- endset -%}

  {{ return(template | trim) }}
{% endmacro %}

{% macro governance_profile_template() %}
  {%- set template -%}
# Anarchitects governance profile content
name: dbt
layers:
  - staging
  - intermediate
  - marts
rules:
  dbt/no-disallowed-layer-dependency:
    enabled: true
    severity: error
    options:
      allowedUpstreamByLayer:
        staging:
          - staging
        intermediate:
          - staging
          - intermediate
        marts:
          - intermediate
          - marts
  {%- endset -%}

  {{ return(template | trim) }}
{% endmacro %}

{% macro governance_print_metadata_template() %}
  {% set template = governance_metadata_template() %}
  {{ log(template, info=True) }}
  {{ return(template) }}
{% endmacro %}

{% macro governance_print_profile_template() %}
  {% set template = governance_profile_template() %}
  {{ log(template, info=True) }}
  {{ return(template) }}
{% endmacro %}
