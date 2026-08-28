import type { BetterAuthOptions } from 'better-auth';
import type { DataSource } from 'typeorm';
import { vi } from 'vitest';

import { createBetterAuthTypeormAdapter } from '../../src/index.js';
import {
  BETTER_AUTH_SUITE_ENTITIES,
  BetterAuthSuiteAccountsEntity,
  BetterAuthSuiteSessionsEntity,
  BetterAuthSuiteUsersEntity,
  BetterAuthSuiteVerificationsEntity,
} from '../postgres/entities.js';
import {
  destroyDataSource,
  startPostgresHarness,
  type PostgresHarness,
} from '../postgres/harness.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const pgMockState = vi.hoisted(() => ({
  connectionString: '',
}));

vi.mock('pg', async () => {
  const actual = await vi.importActual<typeof import('pg')>('pg');

  class PatchedPool extends actual.Pool {
    constructor() {
      if (!pgMockState.connectionString) {
        throw new Error(
          'PostgreSQL harness connection string is not initialized.',
        );
      }

      super({ connectionString: pgMockState.connectionString });
    }
  }

  return {
    ...actual,
    Pool: PatchedPool,
  };
});

const { getTestInstance } = await import('better-auth/test');

function createBetterAuthSuiteOptions(
  dataSource: DataSource,
  sentVerificationEmails: Array<{ email: string; token: string; url: string }>,
  sentResetPasswordEmails: Array<{ email: string; token: string; url: string }>,
): BetterAuthOptions {
  return {
    database: createBetterAuthTypeormAdapter({
      dataSource,
      models: {
        users: BetterAuthSuiteUsersEntity,
        accounts: BetterAuthSuiteAccountsEntity,
        sessions: BetterAuthSuiteSessionsEntity,
        verifications: BetterAuthSuiteVerificationsEntity,
      },
    }),
    advanced: {
      database: {
        generateId: 'uuid',
      },
    },
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, token, url }) => {
        sentResetPasswordEmails.push({ email: user.email, token, url });
      },
    },
    user: {
      modelName: 'users',
      additionalFields: {
        profile: {
          type: 'json',
          required: false,
          returned: true,
          input: true,
        },
      },
    },
    account: {
      modelName: 'accounts',
    },
    session: {
      modelName: 'sessions',
    },
    verification: {
      modelName: 'verifications',
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, token, url }) => {
        sentVerificationEmails.push({ email: user.email, token, url });
      },
    },
  };
}

describe('createBetterAuthTypeormAdapter Better Auth integration', () => {
  let harness: PostgresHarness | null = null;
  let dataSource: DataSource | null = null;

  function getHarness() {
    if (!harness) {
      throw new Error('PostgreSQL harness is not initialized.');
    }

    return harness;
  }

  function getDataSource() {
    if (!dataSource) {
      throw new Error('PostgreSQL data source is not initialized.');
    }

    return dataSource;
  }

  beforeAll(async () => {
    harness = await startPostgresHarness();
    pgMockState.connectionString =
      getHarness().getConnectionDetails().connectionString;
  });

  beforeEach(async () => {
    dataSource = await getHarness().createDataSource(
      [...BETTER_AUTH_SUITE_ENTITIES],
      {
        dropSchema: false,
        synchronize: false,
      },
    );
  });

  afterEach(async () => {
    await destroyDataSource(dataSource);
    dataSource = null;
  });

  it('validates the claimed v1 support scope through better-auth/test', async () => {
    const sentVerificationEmails: Array<{
      email: string;
      token: string;
      url: string;
    }> = [];
    const sentResetPasswordEmails: Array<{
      email: string;
      token: string;
      url: string;
    }> = [];
    const suiteTestUser = {
      email: 'test@test.com',
      password: 'test123456',
      name: 'test user',
      profile: {
        theme: 'light',
        flags: ['beta'],
      },
    };

    const { auth, signInWithTestUser, testUser } = await getTestInstance(
      createBetterAuthSuiteOptions(
        getDataSource(),
        sentVerificationEmails,
        sentResetPasswordEmails,
      ),
      {
        testWith: 'postgres',
        testUser: suiteTestUser as never,
      },
    );

    const usersRepository = getDataSource().getRepository(
      BetterAuthSuiteUsersEntity,
    );
    const accountsRepository = getDataSource().getRepository(
      BetterAuthSuiteAccountsEntity,
    );
    const sessionsRepository = getDataSource().getRepository(
      BetterAuthSuiteSessionsEntity,
    );
    const verificationsRepository = getDataSource().getRepository(
      BetterAuthSuiteVerificationsEntity,
    );

    const storedUser = await usersRepository.findOneByOrFail({
      email: testUser.email,
    });

    expect(storedUser.id).toMatch(UUID_PATTERN);
    expect(storedUser.profile).toEqual(suiteTestUser.profile);
    expect(storedUser.emailVerified).toBe(false);
    expect(storedUser.createdAt).toBeInstanceOf(Date);
    expect(storedUser.updatedAt).toBeInstanceOf(Date);

    expect(await accountsRepository.count()).toBe(1);
    expect(
      await accountsRepository.findOneByOrFail({ userId: storedUser.id }),
    ).toMatchObject({
      issuer: 'local:credential',
      accountId: storedUser.id,
      providerId: 'credential',
    });
    expect(await sessionsRepository.count()).toBeGreaterThan(0);
    expect(await verificationsRepository.count()).toBe(0);
    expect(sentVerificationEmails).toHaveLength(1);

    await auth.api.requestPasswordReset({
      body: {
        email: testUser.email,
        redirectTo: 'http://localhost:3000/reset-password',
      },
    });

    expect(await verificationsRepository.count()).toBe(1);
    expect(sentResetPasswordEmails).toHaveLength(1);

    const signedIn = await signInWithTestUser();

    expect(signedIn.user.id).toBe(storedUser.id);
    expect(signedIn.headers.get('cookie')).toContain(
      'better-auth.session_token=',
    );

    const sessionResult = await auth.api.getSession({
      headers: signedIn.headers,
    });

    expect(sessionResult).not.toBeNull();
    expect(sessionResult?.user.id).toBe(storedUser.id);
    expect(sessionResult?.user.emailVerified).toBe(false);
    expect(sessionResult?.session.userId).toBe(storedUser.id);
    expect(sessionResult?.session.expiresAt).toBeInstanceOf(Date);

    const sessionUser = sessionResult?.user as
      | Record<string, unknown>
      | undefined;

    expect(sessionUser?.profile).toEqual(suiteTestUser.profile);

    await expect(
      auth.api.resetPassword({
        body: {
          newPassword: 'new-test-password-123',
          token: sentResetPasswordEmails[0]?.token,
        },
      }),
    ).resolves.toEqual({ status: true });
    expect(await verificationsRepository.count()).toBe(0);
  });
});
