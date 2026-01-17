import { DataSourceOptions } from 'typeorm';

export const getTypeOrmConfig = (
  options: {
    isTest?: boolean;
    migrationsPath?: string;
    entitiesPath?: string;
    runMigrations?: boolean;
    overrides?: Partial<{
      host: string;
      port: number;
      username: string;
      password: string;
      database: string;
    }>;
  } = {},
): DataSourceOptions => {
  const isTest =
    (options.isTest ?? process.env.NODE_ENV === 'test') ||
    process.env.ENV === 'test';

  const baseConfig: DataSourceOptions = {
    type: 'postgres',
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
    schema: 'public',
    entities: isTest ? ['src/**/*.entity{.ts,.js}'] : ['dist/**/*.entity.js'],
    migrations: isTest
      ? ['db/migrations/*{.ts,.js}']
      : ['dist/db/migrations/*.js'],
    migrationsTableName: 'migrations',
    migrationsRun: options.runMigrations ?? process.env.ENV !== 'test',
    synchronize: false,
    logging: process.env.ENV !== 'production',
    extra: { connectionLimit: 10 },
  };

  if (options.overrides) {
    return {
      ...baseConfig,
      ...options.overrides,
    };
  }

  return baseConfig;
};
