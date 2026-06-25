{% macro anarchitects_governance_normalize_tags(tags) %}
  {% if tags is none %}
    {{ return(none) }}
  {% endif %}

  {% if tags is string %}
    {% set normalized_tag = tags | trim %}
    {% if normalized_tag | length > 0 %}
      {{ return([normalized_tag]) }}
    {% endif %}

    {{ return([]) }}
  {% endif %}

  {% if tags is sequence %}
    {% set normalized = [] %}
    {% for tag in tags %}
      {% if tag is string and (tag | trim | length) > 0 %}
        {% do normalized.append(tag | trim) %}
      {% endif %}
    {% endfor %}

    {{ return(normalized) }}
  {% endif %}

  {{ return([]) }}
{% endmacro %}

{% macro anarchitects_governance_normalize_bool(value) %}
  {% if value in [true, 'true', 'True', 'TRUE', 'yes', 'Yes', '1', 1] %}
    {{ return(true) }}
  {% endif %}

  {{ return(false) }}
{% endmacro %}

{% macro governance(
  owner,
  layer,
  domain,
  criticality='medium',
  public_interface=false,
  cross_domain_approved=false,
  contract_enforced=false,
  tags=none
) %}
  {% set normalized_tags = anarchitects_governance.anarchitects_governance_normalize_tags(tags) %}
  {% set governance_meta = {
    'layer': layer,
    'domain': domain,
    'owner': {
      'team': owner
    },
    'criticality': criticality,
    'publicInterface': public_interface,
    'crossDomainApproved': cross_domain_approved
  } %}
  {% set meta = {
    'anarchitects': {
      'governance': governance_meta
    }
  } %}
  {% set contract = {
    'enforced': contract_enforced
  } %}

  {% if normalized_tags is none %}
    {% set configured = config(meta=meta, contract=contract) %}
  {% else %}
    {% set configured = config(meta=meta, contract=contract, tags=normalized_tags) %}
  {% endif %}

  {{ return(configured) }}
{% endmacro %}

{% macro governance_metadata_template(
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
  {% set template = anarchitects_governance.anarchitects_governance_render_metadata_template(
    model_name=model_name,
    description=description,
    layer=layer,
    domain=domain,
    owner_team=owner_team,
    criticality=criticality,
    public_interface=public_interface,
    cross_domain_approved=cross_domain_approved,
    contract_enforced=contract_enforced
  ) %}

  {{ return(template) }}
{% endmacro %}

{% macro anarchitects_governance_find_model_node(model_name) %}
  {% if not execute %}
    {{ return(none) }}
  {% endif %}

  {% for node in graph.nodes.values() %}
    {% if node.resource_type == 'model' and node.name == model_name %}
      {{ return(node) }}
    {% endif %}
  {% endfor %}

  {{ return(none) }}
{% endmacro %}

{% macro anarchitects_governance_get_node_contract_enforced(node) %}
  {% if node.config is defined and node.config is mapping and node.config.contract is defined and node.config.contract is mapping and node.config.contract.enforced is defined %}
    {{ return(node.config.contract.enforced) }}
  {% endif %}

  {% if node.contract is defined and node.contract is mapping and node.contract.enforced is defined %}
    {{ return(node.contract.enforced) }}
  {% endif %}

  {{ return(none) }}
{% endmacro %}

{% macro anarchitects_governance_get_node_tags(node) %}
  {% if node.tags is defined %}
    {{ return(anarchitects_governance.anarchitects_governance_normalize_tags(node.tags)) }}
  {% endif %}

  {% if node.config is defined and node.config is mapping and node.config.tags is defined %}
    {{ return(anarchitects_governance.anarchitects_governance_normalize_tags(node.config.tags)) }}
  {% endif %}

  {{ return([]) }}
{% endmacro %}

{% macro anarchitects_governance_assert_model_config(
  model_name,
  owner_team,
  layer,
  domain,
  criticality='medium',
  public_interface=false,
  cross_domain_approved=false,
  contract_enforced=false,
  tags=none
) %}
  {% if not execute %}
    {{ log('anarchitects_governance_assert_model_config only inspects graph metadata during execution time.', info=True) }}
    {{ return({'checked': 0, 'errors': 0}) }}
  {% endif %}

  {% set node = anarchitects_governance.anarchitects_governance_find_model_node(model_name) %}
  {% if not node %}
    {{ exceptions.raise_compiler_error('Could not find model "' ~ model_name ~ '" in the dbt graph.') }}
  {% endif %}

  {% set governance = anarchitects_governance.anarchitects_governance_get_node_governance_meta(node) %}
  {% set owner = governance.owner if governance is mapping and governance.owner is defined and governance.owner is mapping else {} %}
  {% set actual_tags = anarchitects_governance.anarchitects_governance_get_node_tags(node) %}
  {% set expected_tags = anarchitects_governance.anarchitects_governance_normalize_tags(tags) %}
  {% set actual_contract_enforced = anarchitects_governance.anarchitects_governance_get_node_contract_enforced(node) %}
  {% set errors = [] %}

  {% if governance.layer != layer %}
    {% do errors.append('Expected meta.anarchitects.governance.layer="' ~ layer ~ '" but found "' ~ governance.layer ~ '".') %}
  {% endif %}

  {% if governance.domain != domain %}
    {% do errors.append('Expected meta.anarchitects.governance.domain="' ~ domain ~ '" but found "' ~ governance.domain ~ '".') %}
  {% endif %}

  {% if owner.team != owner_team %}
    {% do errors.append('Expected meta.anarchitects.governance.owner.team="' ~ owner_team ~ '" but found "' ~ owner.team ~ '".') %}
  {% endif %}

  {% if governance.criticality != criticality %}
    {% do errors.append('Expected meta.anarchitects.governance.criticality="' ~ criticality ~ '" but found "' ~ governance.criticality ~ '".') %}
  {% endif %}

  {% if anarchitects_governance.anarchitects_governance_normalize_bool(governance.publicInterface) != anarchitects_governance.anarchitects_governance_normalize_bool(public_interface) %}
    {% do errors.append('Expected meta.anarchitects.governance.publicInterface to match the configured public_interface value.') %}
  {% endif %}

  {% if anarchitects_governance.anarchitects_governance_normalize_bool(governance.crossDomainApproved) != anarchitects_governance.anarchitects_governance_normalize_bool(cross_domain_approved) %}
    {% do errors.append('Expected meta.anarchitects.governance.crossDomainApproved to match the configured cross_domain_approved value.') %}
  {% endif %}

  {% if anarchitects_governance.anarchitects_governance_normalize_bool(actual_contract_enforced) != anarchitects_governance.anarchitects_governance_normalize_bool(contract_enforced) %}
    {% do errors.append('Expected config.contract.enforced to match the configured contract_enforced value.') %}
  {% endif %}

  {% for expected_tag in expected_tags or [] %}
    {% if expected_tag not in actual_tags %}
      {% do errors.append('Expected tag "' ~ expected_tag ~ '" was not found on model "' ~ model_name ~ '".') %}
    {% endif %}
  {% endfor %}

  {% if errors | length > 0 %}
    {% for error in errors %}
      {{ log(error, info=True) }}
    {% endfor %}
    {{ exceptions.raise_compiler_error('anarchitects_governance_assert_model_config found ' ~ (errors | length) ~ ' mismatch(es) for model "' ~ model_name ~ '".') }}
  {% endif %}

  {{ log('anarchitects_governance_assert_model_config verified inline governance config for model "' ~ model_name ~ '".', info=True) }}
  {{ return({'checked': 1, 'errors': 0}) }}
{% endmacro %}

{% macro governance_profile_template(
  profile_name='dbt',
  layers=none,
  require_ownership=true,
  require_documentation=true
) %}
  {% set template = anarchitects_governance.anarchitects_governance_render_profile_template(
    profile_name=profile_name,
    layers=layers,
    require_ownership=require_ownership,
    require_documentation=require_documentation
  ) %}

  {{ return(template) }}
{% endmacro %}

{% macro governance_print_metadata_template(
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
  {% set template = governance_metadata_template(
    model_name=model_name,
    description=description,
    layer=layer,
    domain=domain,
    owner_team=owner_team,
    criticality=criticality,
    public_interface=public_interface,
    cross_domain_approved=cross_domain_approved,
    contract_enforced=contract_enforced
  ) %}
  {{ log(template, info=True) }}
  {{ return(template) }}
{% endmacro %}

{% macro governance_print_profile_template(
  profile_name='dbt',
  layers=none,
  require_ownership=true,
  require_documentation=true
) %}
  {% set template = governance_profile_template(
    profile_name=profile_name,
    layers=layers,
    require_ownership=require_ownership,
    require_documentation=require_documentation
  ) %}
  {{ log(template, info=True) }}
  {{ return(template) }}
{% endmacro %}
