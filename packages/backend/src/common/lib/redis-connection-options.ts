interface RedisConnectionEnv {
  url?: string;
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  tls?: string;
}

/**
 * Resolve Redis connection settings for both local/self-hosted Redis and hosted
 * TLS URLs such as Upstash's rediss:// connection string.
 */
export function getRedisConnectionOptions(env: RedisConnectionEnv = process.env) {
  if (env.url) {
    const url = new URL(env.url);
    if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
      throw new Error('APPLICATION_REDIS_URL must use redis:// or rediss://');
    }
    if (!url.hostname) throw new Error('APPLICATION_REDIS_URL must include a hostname');

    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 6379,
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
      tls: url.protocol === 'rediss:' ? {} : undefined,
    };
  }

  return {
    host: env.host,
    port: env.port ? Number(env.port) : undefined,
    username: env.username,
    password: env.password,
    tls: env.tls === 'true' ? {} : undefined,
  };
}
