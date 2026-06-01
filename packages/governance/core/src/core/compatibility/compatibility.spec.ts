import type {
  GovernanceDependencyInput,
  GovernanceProjectInput,
} from '../adapter/adapter.js';
import {
  dependenciesToRelations,
  dependencyToRelation,
  projectToNode,
  projectsToNodes,
} from './compatibility.js';

describe('Governance compatibility helpers', () => {
  it('maps legacy project inputs to canonical node inputs', () => {
    const project = {
      id: 'booking-api',
      name: 'Booking API',
      root: 'packages/booking-api',
      type: 'library',
      domain: 'booking',
      layer: 'domain',
      scope: 'internal',
      tags: ['critical'],
      ownership: {
        team: 'booking',
      },
      metadata: {
        documentation: true,
      },
    } satisfies GovernanceProjectInput;

    expect(projectToNode(project)).toEqual({
      id: 'booking-api',
      name: 'Booking API',
      kind: 'library',
      root: 'packages/booking-api',
      tags: ['critical'],
      classification: {
        domain: 'booking',
        layer: 'domain',
        scope: 'internal',
      },
      ownership: {
        team: 'booking',
      },
      metadata: {
        documentation: true,
      },
    });
  });

  it('uses project kind and empty collections for minimal project inputs', () => {
    expect(
      projectToNode({
        id: 'booking-api',
      }),
    ).toEqual({
      id: 'booking-api',
      kind: 'project',
      tags: [],
      metadata: {},
    });
  });

  it('maps legacy dependency inputs to canonical relation inputs', () => {
    const dependency = {
      sourceProjectId: 'booking-api',
      targetProjectId: 'shared-domain',
      type: 'static',
      sourceFile: 'packages/booking-api/src/index.ts',
      metadata: {
        importKind: 'value',
      },
    } satisfies GovernanceDependencyInput;

    expect(dependencyToRelation(dependency, { index: 0 })).toEqual({
      id: 'legacy:booking-api->shared-domain:static:0',
      sourceNodeId: 'booking-api',
      targetNodeId: 'shared-domain',
      kind: 'dependency',
      metadata: {
        importKind: 'value',
        dependencyType: 'static',
        sourceFile: 'packages/booking-api/src/index.ts',
      },
    });
  });

  it('maps project and dependency collections deterministically', () => {
    const projects = [
      {
        id: 'project-a',
      },
      {
        id: 'project-b',
      },
    ] satisfies GovernanceProjectInput[];
    const dependencies = [
      {
        sourceProjectId: 'project-a',
        targetProjectId: 'project-b',
      },
      {
        sourceProjectId: 'project-a',
        targetProjectId: 'project-b',
      },
    ] satisfies GovernanceDependencyInput[];

    expect(projectsToNodes(projects).map((node) => node.id)).toEqual([
      'project-a',
      'project-b',
    ]);
    expect(
      dependenciesToRelations(dependencies).map((relation) => relation.id),
    ).toEqual([
      'legacy:project-a->project-b:dependency:0',
      'legacy:project-a->project-b:dependency:1',
    ]);
  });

  it('handles omitted collections as empty collections', () => {
    expect(projectsToNodes()).toEqual([]);
    expect(dependenciesToRelations()).toEqual([]);
  });
});
