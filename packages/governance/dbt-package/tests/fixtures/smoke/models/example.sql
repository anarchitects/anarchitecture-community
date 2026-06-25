{{ anarchitects_governance.governance(
    owner='analytics',
    layer='marts',
    domain='ecommerce',
    criticality='high',
    public_interface=true,
    cross_domain_approved=false,
    contract_enforced=true,
    tags=['layer:marts', 'domain:ecommerce', 'published']
) }}

select 1 as id
