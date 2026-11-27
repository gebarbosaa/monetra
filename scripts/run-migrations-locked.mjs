import { spawn } from 'node:child_process';
import { Pool } from 'pg';

const pool = new Pool({
  ...(process.env.APPLICATION_DB_URL
    ? { connectionString: process.env.APPLICATION_DB_URL }
    : {
        host: process.env.APPLICATION_DB_HOST,
        port: process.env.APPLICATION_DB_PORT ? Number(process.env.APPLICATION_DB_PORT) : undefined,
        user: process.env.APPLICATION_DB_USERNAME,
        password: process.env.APPLICATION_DB_PASSWORD,
        database: process.env.APPLICATION_DB_DATABASE,
      }),
  max: 1,
  connectionTimeoutMillis: 15000,
});

const client = await pool.connect();
const lockKey = 20261127;
const lockSubkey = 1;

try {
  await client.query('SELECT pg_advisory_lock($1, $2)', [lockKey, lockSubkey]);
  await new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'migrate', '--workspace=packages/backend'], {
      cwd: '/app',
      env: process.env,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Sequelize migrations exited with code ${code ?? 'null'} (signal ${signal ?? 'none'}).`));
    });
  });
} finally {
  await client.query('SELECT pg_advisory_unlock($1, $2)', [lockKey, lockSubkey]).catch(() => undefined);
  client.release();
  await pool.end();
}
