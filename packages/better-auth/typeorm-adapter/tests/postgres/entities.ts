import { EntitySchema } from 'typeorm';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountRow {
  id: string;
  issuer: string;
  accountId: string;
  providerId: string;
  userId: string;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  scope: string | null;
  password: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRow {
  id: string;
  userId: string;
  expiresAt: Date;
  token: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationRow {
  id: string;
  identifier: string;
  value: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransformedUserRow {
  id: string;
  emailAddress: string;
  fullName: string;
  emailVerified: boolean;
  profileImage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransformedAccountRow {
  id: string;
  trustedIssuer: string;
  providerAccountId: string;
  providerName: string;
  ownerUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AtomicCounterRow {
  id: string;
  remainingUses: number;
  state: string;
  note: string | null;
}

export interface BetterAuthSuiteUserRow {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null;
  profile: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export type BetterAuthSuiteAccountRow = AccountRow;

export type BetterAuthSuiteSessionRow = SessionRow;

export type BetterAuthSuiteVerificationRow = VerificationRow;

export const UsersEntity = new EntitySchema<UserRow>({
  name: 'UsersEntity',
  tableName: 'users',
  columns: {
    id: { type: 'uuid', primary: true },
    email: { type: 'varchar', unique: true },
    name: { type: 'varchar' },
    emailVerified: { type: 'boolean' },
    image: { type: 'varchar', nullable: true },
    createdAt: { type: 'timestamptz' },
    updatedAt: { type: 'timestamptz' },
  },
});

export const AccountsEntity = new EntitySchema<AccountRow>({
  name: 'AccountsEntity',
  tableName: 'accounts',
  indices: [
    {
      name: 'uq_accounts_issuer_account_id',
      columns: ['issuer', 'accountId'],
      unique: true,
    },
  ],
  columns: {
    id: { type: 'uuid', primary: true },
    issuer: { type: 'varchar' },
    accountId: { type: 'varchar' },
    providerId: { type: 'varchar' },
    userId: { type: 'uuid' },
    accessToken: { type: 'varchar', nullable: true },
    refreshToken: { type: 'varchar', nullable: true },
    idToken: { type: 'varchar', nullable: true },
    accessTokenExpiresAt: { type: 'timestamptz', nullable: true },
    refreshTokenExpiresAt: { type: 'timestamptz', nullable: true },
    scope: { type: 'varchar', nullable: true },
    password: { type: 'varchar', nullable: true },
    createdAt: { type: 'timestamptz' },
    updatedAt: { type: 'timestamptz' },
  },
});

export const SessionsEntity = new EntitySchema<SessionRow>({
  name: 'SessionsEntity',
  tableName: 'sessions',
  columns: {
    id: { type: 'uuid', primary: true },
    userId: { type: 'uuid' },
    expiresAt: { type: 'timestamptz' },
    token: { type: 'varchar', unique: true },
    ipAddress: { type: 'varchar', nullable: true },
    userAgent: { type: 'varchar', nullable: true },
    createdAt: { type: 'timestamptz' },
    updatedAt: { type: 'timestamptz' },
  },
});

export const VerificationsEntity = new EntitySchema<VerificationRow>({
  name: 'VerificationsEntity',
  tableName: 'verifications',
  columns: {
    id: { type: 'uuid', primary: true },
    identifier: { type: 'varchar' },
    value: { type: 'varchar' },
    expiresAt: { type: 'timestamptz' },
    createdAt: { type: 'timestamptz' },
    updatedAt: { type: 'timestamptz' },
  },
});

export const AppUsersEntity = new EntitySchema<TransformedUserRow>({
  name: 'AppUsersEntity',
  tableName: 'app_users',
  columns: {
    id: { type: 'uuid', primary: true },
    emailAddress: {
      type: 'varchar',
      unique: true,
      name: 'email_address',
    },
    fullName: {
      type: 'varchar',
      name: 'full_name',
    },
    emailVerified: {
      type: 'boolean',
      name: 'email_verified',
    },
    profileImage: {
      type: 'varchar',
      nullable: true,
      name: 'profile_image',
    },
    createdAt: {
      type: 'timestamptz',
      name: 'created_at',
    },
    updatedAt: {
      type: 'timestamptz',
      name: 'updated_at',
    },
  },
});

export const AppAccountsEntity = new EntitySchema<TransformedAccountRow>({
  name: 'AppAccountsEntity',
  tableName: 'app_accounts',
  indices: [
    {
      name: 'uq_app_accounts_issuer_account_id',
      columns: ['trustedIssuer', 'providerAccountId'],
      unique: true,
    },
  ],
  columns: {
    id: { type: 'uuid', primary: true },
    trustedIssuer: {
      type: 'varchar',
      name: 'issuer_url',
    },
    providerAccountId: {
      type: 'varchar',
      name: 'provider_account_id',
    },
    providerName: {
      type: 'varchar',
      name: 'provider_name',
    },
    ownerUserId: {
      type: 'uuid',
      name: 'owner_user_id',
    },
    createdAt: {
      type: 'timestamptz',
      name: 'created_at',
    },
    updatedAt: {
      type: 'timestamptz',
      name: 'updated_at',
    },
  },
});

export const AtomicCountersEntity = new EntitySchema<AtomicCounterRow>({
  name: 'AtomicCountersEntity',
  tableName: 'atomic_counters',
  columns: {
    id: { type: 'uuid', primary: true },
    remainingUses: {
      type: 'integer',
      name: 'remaining_uses',
    },
    state: {
      type: 'varchar',
      name: 'state_code',
    },
    note: {
      type: 'varchar',
      name: 'note_text',
      nullable: true,
    },
  },
});

export const BetterAuthSuiteUsersEntity =
  new EntitySchema<BetterAuthSuiteUserRow>({
    name: 'BetterAuthSuiteUsersEntity',
    tableName: 'users',
    columns: {
      id: { type: 'uuid', primary: true, generated: 'uuid' },
      email: { type: 'varchar', unique: true },
      name: { type: 'varchar' },
      emailVerified: { type: 'boolean' },
      image: { type: 'varchar', nullable: true },
      profile: { type: 'jsonb', nullable: true },
      createdAt: { type: 'timestamptz' },
      updatedAt: { type: 'timestamptz' },
    },
  });

export const BetterAuthSuiteAccountsEntity =
  new EntitySchema<BetterAuthSuiteAccountRow>({
    name: 'BetterAuthSuiteAccountsEntity',
    tableName: 'accounts',
    indices: [
      {
        name: 'uq_better_auth_accounts_issuer_account_id',
        columns: ['issuer', 'accountId'],
        unique: true,
      },
    ],
    columns: {
      id: { type: 'uuid', primary: true, generated: 'uuid' },
      issuer: { type: 'varchar' },
      accountId: { type: 'varchar' },
      providerId: { type: 'varchar' },
      userId: { type: 'uuid' },
      accessToken: { type: 'varchar', nullable: true },
      refreshToken: { type: 'varchar', nullable: true },
      idToken: { type: 'varchar', nullable: true },
      accessTokenExpiresAt: { type: 'timestamptz', nullable: true },
      refreshTokenExpiresAt: { type: 'timestamptz', nullable: true },
      scope: { type: 'varchar', nullable: true },
      password: { type: 'varchar', nullable: true },
      createdAt: { type: 'timestamptz' },
      updatedAt: { type: 'timestamptz' },
    },
  });

export const BetterAuthSuiteSessionsEntity =
  new EntitySchema<BetterAuthSuiteSessionRow>({
    name: 'BetterAuthSuiteSessionsEntity',
    tableName: 'sessions',
    columns: {
      id: { type: 'uuid', primary: true, generated: 'uuid' },
      userId: { type: 'uuid' },
      expiresAt: { type: 'timestamptz' },
      token: { type: 'varchar', unique: true },
      ipAddress: { type: 'varchar', nullable: true },
      userAgent: { type: 'varchar', nullable: true },
      createdAt: { type: 'timestamptz' },
      updatedAt: { type: 'timestamptz' },
    },
  });

export const BetterAuthSuiteVerificationsEntity =
  new EntitySchema<BetterAuthSuiteVerificationRow>({
    name: 'BetterAuthSuiteVerificationsEntity',
    tableName: 'verifications',
    columns: {
      id: { type: 'uuid', primary: true, generated: 'uuid' },
      identifier: { type: 'varchar' },
      value: { type: 'varchar' },
      expiresAt: { type: 'timestamptz' },
      createdAt: { type: 'timestamptz' },
      updatedAt: { type: 'timestamptz' },
    },
  });

export const CORE_ENTITIES = [
  UsersEntity,
  AccountsEntity,
  SessionsEntity,
  VerificationsEntity,
  AtomicCountersEntity,
] as const;

export const TRANSFORMED_ENTITIES = [
  AppUsersEntity,
  AppAccountsEntity,
] as const;

export const BETTER_AUTH_SUITE_ENTITIES = [
  BetterAuthSuiteUsersEntity,
  BetterAuthSuiteAccountsEntity,
  BetterAuthSuiteSessionsEntity,
  BetterAuthSuiteVerificationsEntity,
] as const;
