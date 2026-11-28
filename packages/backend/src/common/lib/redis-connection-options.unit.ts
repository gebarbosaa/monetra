import { describe, expect, it } from '@jest/globals';

import { getRedisConnectionOptions } from './redis-connection-options';

describe('getRedisConnectionOptions', () => {
  it('parses a hosted TLS URL, including encoded credentials and a database path', () => {
    expect(
      getRedisConnectionOptions({
        APPLICATION_REDIS_URL: 'rediss://default:secret%40value@redis.example.com:6380/2',
      }),
    ).toEqual({
      host: 'redis.example.com',
      port: 6380,
      username: 'default',
      password: 'secret@value',
      db: 2,
      tls: {},
    });
  });

  it('accepts the standard REDIS_URL injected by Vercel Marketplace integrations', () => {
    expect(getRedisConnectionOptions({ REDIS_URL: 'rediss://default:token@redis.example.com:6379' })).toMatchObject({
      host: 'redis.example.com',
      port: 6379,
      username: 'default',
      password: 'token',
      tls: {},
    });
  });

  it('keeps local host settings for self-hosted Redis', () => {
    expect(
      getRedisConnectionOptions({
        APPLICATION_REDIS_HOST: '127.0.0.1',
        APPLICATION_REDIS_PORT: '6379',
        APPLICATION_REDIS_USERNAME: 'local-user',
        APPLICATION_REDIS_PASSWORD: 'local-password',
        APPLICATION_REDIS_TLS: 'false',
      }),
    ).toEqual({
      host: '127.0.0.1',
      port: 6379,
      username: 'local-user',
      password: 'local-password',
      tls: undefined,
    });
  });

  it('rejects unsupported URL protocols instead of silently connecting to localhost', () => {
    expect(() => getRedisConnectionOptions({ APPLICATION_REDIS_URL: 'https://redis.example.com' })).toThrow(
      'APPLICATION_REDIS_URL must use redis:// or rediss://',
    );
  });
});
