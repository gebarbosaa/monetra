import { describe, expect, it } from '@jest/globals';

import { getRedisConnectionOptions } from './redis-connection-options';

describe('getRedisConnectionOptions', () => {
  it('parses a hosted TLS URL, including encoded credentials and a database path', () => {
    expect(
      getRedisConnectionOptions({
        url: 'rediss://default:secret%40value@redis.example.com:6380/2',
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

  it('keeps local host settings for self-hosted Redis', () => {
    expect(
      getRedisConnectionOptions({
        host: '127.0.0.1',
        port: '6379',
        username: 'local-user',
        password: 'local-password',
        tls: 'false',
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
    expect(() => getRedisConnectionOptions({ url: 'https://redis.example.com' })).toThrow(
      'APPLICATION_REDIS_URL must use redis:// or rediss://',
    );
  });
});
