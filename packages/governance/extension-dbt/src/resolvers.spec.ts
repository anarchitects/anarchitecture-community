import {
  resolveDbtContractPresence,
  resolveDbtCriticality,
  resolveDbtDocumentationPresence,
  resolveDbtDomain,
  resolveDbtGovernanceMetadata,
  resolveDbtLayer,
  resolveDbtOwner,
  resolveDbtPublicInterface,
  resolveDbtTestPresence,
  type DbtGovernanceMetadataResolverInput,
} from './index.js';

describe('dbt governance metadata resolvers', () => {
  function createInput(
    overrides: Partial<DbtGovernanceMetadataResolverInput> = {},
  ): DbtGovernanceMetadataResolverInput {
    return {
      id: 'model.valid_project.orders',
      name: 'orders',
      tags: [],
      metadata: {
        dbt: {
          identity: {
            uniqueId: 'model.valid_project.orders',
          },
          resource: {
            tags: [],
            meta: {},
          },
          relation: {
            originalFilePath: 'models/marts/orders.sql',
          },
          validation: {},
          documentation: {
            hasDescription: false,
            hasDocs: false,
          },
        },
      },
      ...overrides,
    };
  }

  it('resolves governance metadata from normalized dbt metadata and project fields', () => {
    const input = createInput({
      domain: 'finance',
      layer: 'transform',
      ownership: {
        team: 'finance-platform',
        source: 'project-metadata',
      },
      tags: ['published', 'layer:marts'],
      metadata: {
        dbt: {
          identity: {
            uniqueId: 'model.valid_project.orders',
          },
          resource: {
            tags: ['published', 'layer:marts'],
            meta: {
              domain: 'finance',
              layer: 'transform',
              criticality: 'high',
              public: true,
            },
            owner: {
              name: 'finance-platform',
            },
            group: 'finance',
            materialization: 'table',
          },
          relation: {
            originalFilePath: 'models/marts/orders.sql',
          },
          validation: {
            tests: ['unique:order_id'],
            contract: {
              enforced: true,
            },
          },
          documentation: {
            description: 'Normalized orders model',
            hasDescription: true,
            hasDocs: true,
          },
        },
      },
    });

    const resolved = resolveDbtGovernanceMetadata(input);

    expect(resolved.layer).toMatchObject({
      status: 'resolved',
      value: 'transform',
      governanceNodeId: 'model.valid_project.orders',
      dbtUniqueId: 'model.valid_project.orders',
    });
    expect(resolved.domain).toMatchObject({
      status: 'resolved',
      value: 'finance',
    });
    expect(resolved.owner).toMatchObject({
      status: 'resolved',
      value: 'finance-platform',
    });
    expect(resolved.criticality).toMatchObject({
      status: 'resolved',
      value: 'high',
    });
    expect(resolved.publicInterface).toMatchObject({
      status: 'resolved',
      value: true,
    });
    expect(resolved.materializationCategory).toMatchObject({
      status: 'resolved',
      value: 'table',
    });
    expect(resolved.documentationPresent).toMatchObject({
      status: 'resolved',
      value: true,
    });
    expect(resolved.testsPresent).toMatchObject({
      status: 'resolved',
      value: true,
    });
    expect(resolved.contractPresent).toMatchObject({
      status: 'resolved',
      value: true,
    });
  });

  it('supports path-driven layer and domain conventions when enabled', () => {
    const input = createInput({
      metadata: {
        dbt: {
          identity: {
            uniqueId: 'model.valid_project.customer_orders',
          },
          resource: {
            tags: [],
            meta: {},
          },
          relation: {
            originalFilePath: 'models/finance/marts/customer_orders.sql',
          },
          validation: {},
          documentation: {},
        },
      },
    });

    expect(resolveDbtLayer(input)).toMatchObject({
      status: 'resolved',
      value: 'marts',
    });
    expect(
      resolveDbtDomain(input, {
        domain: {
          fromPath: true,
        },
      }),
    ).toMatchObject({
      status: 'resolved',
      value: 'finance',
    });
  });

  it('distinguishes ambiguous and invalid metadata instead of fabricating values', () => {
    const ambiguousInput = createInput({
      domain: 'sales',
      metadata: {
        dbt: {
          identity: {
            uniqueId: 'model.valid_project.orders',
          },
          resource: {
            tags: [],
            meta: {
              domain: 'finance',
            },
          },
          relation: {
            originalFilePath: 'models/sales/marts/orders.sql',
          },
          validation: {},
          documentation: {},
        },
      },
    });
    const invalidInput = createInput({
      metadata: {
        dbt: {
          identity: {
            uniqueId: 'model.valid_project.orders',
          },
          resource: {
            tags: [],
            meta: {
              layer: {
                name: 'marts',
              },
              criticality: ['high'],
              public: 'maybe',
            },
            owner: 42,
          },
          relation: {
            originalFilePath: 'models/marts/orders.sql',
          },
          validation: {
            tests: {
              count: 2,
            },
            contract: 'enforced',
          },
          documentation: {
            description: {
              markdown: 'orders',
            },
          },
        },
      },
    });

    expect(
      resolveDbtDomain(ambiguousInput, {
        domain: {
          fromPath: true,
        },
      }),
    ).toMatchObject({
      status: 'ambiguous',
      values: expect.arrayContaining(['finance', 'sales']),
    });
    expect(resolveDbtLayer(invalidInput)).toMatchObject({
      status: 'invalid',
    });
    expect(resolveDbtCriticality(invalidInput)).toMatchObject({
      status: 'invalid',
    });
    expect(resolveDbtPublicInterface(invalidInput)).toMatchObject({
      status: 'invalid',
    });
    expect(resolveDbtOwner(invalidInput)).toMatchObject({
      status: 'invalid',
    });
    expect(resolveDbtDocumentationPresence(invalidInput)).toMatchObject({
      status: 'invalid',
    });
    expect(resolveDbtTestPresence(invalidInput)).toMatchObject({
      status: 'invalid',
    });
    expect(resolveDbtContractPresence(invalidInput)).toMatchObject({
      status: 'invalid',
    });
  });

  it('treats missing metadata as unresolved rather than as a violation', () => {
    const input = createInput();

    expect(
      resolveDbtDomain(input, {
        domain: {
          fromPath: false,
        },
      }),
    ).toMatchObject({
      status: 'unresolved',
    });
    expect(resolveDbtOwner(input)).toMatchObject({
      status: 'unresolved',
    });
    expect(resolveDbtCriticality(input)).toMatchObject({
      status: 'unresolved',
    });
  });

  it('treats inferred dependent dbt test nodes as sufficient test evidence', () => {
    expect(
      resolveDbtTestPresence(
        createInput({
          metadata: {
            dbt: {
              identity: {
                uniqueId: 'model.valid_project.orders',
              },
              resource: {
                tags: [],
                meta: {},
              },
              relation: {
                originalFilePath: 'models/marts/orders.sql',
              },
              validation: {
                tests: [],
              },
              documentation: {},
            },
          },
          inferredTestNodeIds: [
            'test.valid_project.not_null_orders_order_id',
            'test.valid_project.unique_orders_order_id',
          ],
        }),
      ),
    ).toMatchObject({
      status: 'resolved',
      value: true,
      sourcePaths: ['runtime.dbt.inferredTestNodeIds'],
    });
  });

  it('supports inferred dbt source test evidence when direct tests are absent', () => {
    expect(
      resolveDbtTestPresence(
        createInput({
          id: 'source.valid_project.raw.orders',
          metadata: {
            dbt: {
              identity: {
                uniqueId: 'source.valid_project.raw.orders',
              },
              resource: {
                tags: [],
                meta: {},
              },
              relation: {
                originalFilePath: 'models/raw/raw.yml',
              },
              validation: {},
              documentation: {},
            },
          },
          inferredTestNodeIds: [
            'test.valid_project.source_freshness_raw_orders',
          ],
        }),
      ),
    ).toMatchObject({
      status: 'resolved',
      value: true,
    });
  });

  it('interprets normalized source metadata using the dbt source precedence strategy', () => {
    const input = createInput({
      id: 'source.valid_project.raw.orders',
      domain: 'source-table-domain',
      layer: 'source-table-layer',
      ownership: {
        team: 'source-table-owner',
        source: 'dbt-manifest',
      },
      metadata: {
        dbt: {
          identity: {
            uniqueId: 'source.valid_project.raw.orders',
            resourceType: 'source',
          },
          resource: {
            meta: {
              lineage: 'external',
              owner: 'source-table-owner',
              domain: 'source-table-domain',
              layer: 'source-table-layer',
              criticality: 'high',
            },
            sourceMeta: {
              governance: {
                owner: 'raw-data-team',
                domain: 'finance',
                layer: 'raw',
                criticality: 'medium',
              },
            },
          },
          relation: {
            originalFilePath: 'models/raw/raw.yml',
          },
          validation: {},
          documentation: {},
        },
      },
    });

    expect(resolveDbtOwner(input)).toMatchObject({
      status: 'resolved',
      value: 'source-table-owner',
      sourcePaths: ['node.ownership.team'],
    });
    expect(resolveDbtDomain(input)).toMatchObject({
      status: 'resolved',
      value: 'source-table-domain',
      sourcePaths: expect.arrayContaining(['node.classification.domain']),
    });
    expect(resolveDbtLayer(input)).toMatchObject({
      status: 'resolved',
      value: 'source-table-layer',
      sourcePaths: expect.arrayContaining(['node.classification.layer']),
    });
    expect(resolveDbtCriticality(input)).toMatchObject({
      status: 'resolved',
      value: 'high',
      sourcePaths: ['metadata.dbt.resource.meta.criticality'],
    });
  });

  it('leaves dbt source metadata unresolved when neither table nor source metadata is present', () => {
    const input = createInput({
      id: 'source.valid_project.raw.orders',
      metadata: {
        dbt: {
          identity: {
            uniqueId: 'source.valid_project.raw.orders',
            resourceType: 'source',
          },
          resource: {
            tags: [],
            meta: {},
          },
          relation: {
            originalFilePath: 'models/raw/raw.yml',
          },
          validation: {},
          documentation: {},
        },
      },
    });

    expect(resolveDbtOwner(input)).toMatchObject({
      status: 'unresolved',
    });
    expect(
      resolveDbtDomain(input, {
        domain: {
          fromPath: false,
        },
      }),
    ).toMatchObject({
      status: 'unresolved',
    });
    expect(resolveDbtCriticality(input)).toMatchObject({
      status: 'unresolved',
    });
  });
});
