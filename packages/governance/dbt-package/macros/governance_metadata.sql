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
