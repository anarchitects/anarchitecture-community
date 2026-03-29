import { GenericContainer } from 'testcontainers';
import { DataSource, type DataSourceOptions } from 'typeorm';

const POSTGRES_DB = 'better_auth_adapter';
const POSTGRES_USER = 'postgres';
const POSTGRES_PASSWORD = 'postgres';
const POSTGRES_PORT = 5432;
const MAX_INITIALIZE_ATTEMPTS = 20;
const INITIALIZE_RETRY_DELAY_MS = 500;

type EntityList = NonNullable<DataSourceOptions['entities']>;

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export interface PostgresHarness {
  createDataSource: (entities: EntityList) => Promise<DataSource>;
  stop: () => Promise<void>;
}

export async function startPostgresHarness(): Promise<PostgresHarness> {
  const container = await new GenericContainer('postgres:16-alpine')
    .withEnvironment({
      POSTGRES_DB,
      POSTGRES_USER,
      POSTGRES_PASSWORD,
    })
    .withExposedPorts(POSTGRES_PORT)
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(POSTGRES_PORT);

  return {
    async createDataSource(entities: EntityList) {
      const dataSource = new DataSource({
        type: 'postgres',
        host,
        port,
        username: POSTGRES_USER,
        password: POSTGRES_PASSWORD,
        database: POSTGRES_DB,
        entities,
        synchronize: true,
        dropSchema: true,
      });

      for (let attempt = 1; attempt <= MAX_INITIALIZE_ATTEMPTS; attempt += 1) {
        try {
          await dataSource.initialize();
          return dataSource;
        } catch (error) {
          if (attempt === MAX_INITIALIZE_ATTEMPTS) {
            throw error;
          }

          await sleep(INITIALIZE_RETRY_DELAY_MS);
        }
      }

      throw new Error('Failed to initialize PostgreSQL test data source.');
    },
    async stop() {
      await container.stop();
    },
  };
}

export async function destroyDataSource(dataSource: DataSource | null) {
  if (dataSource?.isInitialized) {
    await dataSource.destroy();
  }
}
