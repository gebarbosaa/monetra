interface RedisConnectionEnv {
  APPLICATION_REDIS_URL?: string;
  REDIS_URL?: string;
  APPLICATION_REDIS_HOST?: string;
  APPLICATION_REDIS_PORT?: string;
  APPLICATION_REDIS_USERNAME?: string;
  APPLICATION_REDIS_PASSWORD?: string;
  APPLICATION_REDIS_TLS?: string;
}

/**
 * Resolve Redis connection settings for local/self-hosted Redis and hosted
 * TLS URLs such as Upstash's rediss:// connection string.
 */
export function getRedisConnectionOptions(env: RedisConnectionEnv = process.env) {
  // Upstash's Vercel integration provides REDIS_URL; existing deployments may
  // use the explicit APPLICATION_REDIS_URL name.
  const connectionUrl = env.APPLICATION_REDIS_URL?.trim() || env.REDIS_URL?.trim();

  if (connectionUrl) {
    const url = new URL(connectionUrl);
    if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
      throw new Error('Redis URL must use redis:// or rediss://');
    }
    if (!url.hostname) throw new Error('Redis URL must include a hostname');

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
    host: env.APPLICATION_REDIS_HOST,
    port: env.APPLICATION_REDIS_PORT ? Number(env.APPLICATION_REDIS_PORT) : undefined,
    username: env.APPLICATION_REDIS_USERNAME,
    password: env.APPLICATION_REDIS_PASSWORD,
    tls: env.APPLICATION_REDIS_TLS === 'true' ? {} : undefined,
  };
}
