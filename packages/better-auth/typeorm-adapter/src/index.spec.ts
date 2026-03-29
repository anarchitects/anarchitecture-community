import type { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { expectTypeOf } from 'vitest';

import {
  createBetterAuthTypeormAdapter,
  type BetterAuthTypeormAdapterOptions,
  type BetterAuthTypeormModelMap,
} from './index.js';

describe('package entrypoint', () => {
  it('exports a Better Auth database adapter factory', async () => {
    const entrypoint = await import('./index.js');
    const database = createBetterAuthTypeormAdapter({
      dataSource: { manager: {} } as DataSource,
      models: {},
    });
    const adapter = database({});

    expect(entrypoint.createBetterAuthTypeormAdapter).toBe(
      createBetterAuthTypeormAdapter,
    );
    expect(database).toBeTypeOf('function');
    expect(adapter.id).toBe('typeorm');
    expect(adapter.options?.adapterConfig).toMatchObject({
      adapterId: 'typeorm',
      adapterName: 'TypeORM',
      usePlural: false,
      supportsNumericIds: false,
      supportsUUIDs: true,
      supportsJSON: true,
      supportsDates: true,
      supportsBooleans: true,
      supportsArrays: false,
    });
  });

  it('respects adapter metadata overrides', () => {
    const database = createBetterAuthTypeormAdapter({
      dataSource: { manager: {} } as DataSource,
      models: {},
      adapterId: 'custom-typeorm',
      adapterName: 'Custom TypeORM',
    });
    const adapter = database({});

    expect(adapter.id).toBe('custom-typeorm');
    expect(adapter.options?.adapterConfig).toMatchObject({
      adapterId: 'custom-typeorm',
      adapterName: 'Custom TypeORM',
    });
  });

  it('locks the public type contract', () => {
    const models: BetterAuthTypeormModelMap = {
      user: 'user',
    };

    const options: BetterAuthTypeormAdapterOptions = {
      dataSource: {} as DataSource,
      models,
      adapterId: 'typeorm',
      adapterName: 'TypeORM',
    };

    expectTypeOf<BetterAuthTypeormModelMap>().toEqualTypeOf<
      Record<string, EntityTarget<ObjectLiteral>>
    >();
    expectTypeOf(options.dataSource).toEqualTypeOf<DataSource>();
    expectTypeOf(options.models).toEqualTypeOf<BetterAuthTypeormModelMap>();
  });
});
