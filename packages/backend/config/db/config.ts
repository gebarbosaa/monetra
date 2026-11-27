import { config } from 'dotenv';
import { Dialect } from 'sequelize';

config({ path: `../../.env.${process.env.NODE_ENV}` });

interface DatabaseConfig {
  username: string;
  password: string;
  database: string;
  host: string;
  port: number;
  dialect: Dialect;
  logging: boolean;
  dialectOptions?: { ssl: { require: boolean; rejectUnauthorized: boolean } };
}

interface Config {
  [key: string]: DatabaseConfig;
}

const databaseUrl = process.env.APPLICATION_DB_URL ? new URL(process.env.APPLICATION_DB_URL) : undefined;

const databaseConfig: Config = {
  [process.env.NODE_ENV as string]: {
    username: databaseUrl ? decodeURIComponent(databaseUrl.username) : (process.env.APPLICATION_DB_USERNAME as string),
    password: databaseUrl ? decodeURIComponent(databaseUrl.password) : (process.env.APPLICATION_DB_PASSWORD as string),
    database: databaseUrl ? decodeURIComponent(databaseUrl.pathname.slice(1)) : (process.env.APPLICATION_DB_DATABASE as string),
    host: databaseUrl?.hostname || (process.env.APPLICATION_DB_HOST as string),
    port: databaseUrl?.port ? Number(databaseUrl.port) : parseInt(process.env.APPLICATION_DB_PORT as string, 10),
    dialect: (process.env.APPLICATION_DB_DIALECT as Dialect) || 'postgres',
    logging: false,
    ...(databaseUrl?.searchParams.get('sslmode') === 'require'
      ? { dialectOptions: { ssl: { require: true, rejectUnauthorized: true } } }
      : {}),
  },
};

export = databaseConfig;
