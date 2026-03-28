import type { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { expectTypeOf } from 'vitest';

import {
  createBetterAuthTypeormAdapter,
  type BetterAuthTypeormAdapterOptions,
  type BetterAuthTypeormModelMap,
} from './index.js';

describe('package entrypoint', () => {
  it('exports the stub adapter factory and throws until runtime support lands', async () => {
    const entrypoint = await import('./index.js');

    expect(entrypoint.createBetterAuthTypeormAdapter).toBe(
      createBetterAuthTypeormAdapter,
    );
    expect(() =>
      createBetterAuthTypeormAdapter({
        dataSource: {} as DataSource,
        models: {},
      }),
    ).toThrowError('createBetterAuthTypeormAdapter is not implemented yet.');
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
