import type { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';

export type BetterAuthTypeormModelMap = Record<
  string,
  EntityTarget<ObjectLiteral>
>;

export interface BetterAuthTypeormAdapterOptions {
  dataSource: DataSource;
  models: BetterAuthTypeormModelMap;
  adapterId?: string;
  adapterName?: string;
}
