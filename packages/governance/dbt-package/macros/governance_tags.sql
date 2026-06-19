{% macro governance_layer_tag(layer) %}
  {{ return('layer:' ~ (layer | string | trim)) }}
{% endmacro %}

{% macro governance_domain_tag(domain) %}
  {{ return('domain:' ~ (domain | string | trim)) }}
{% endmacro %}

{% macro governance_scope_tag(scope) %}
  {{ return('scope:' ~ (scope | string | trim)) }}
{% endmacro %}
