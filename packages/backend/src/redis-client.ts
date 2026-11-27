import './bootstrap';

import { logger } from '@js/utils/logger';
import Redis from 'ioredis';

import { clearAllSyncStatuses } from './services/bank-data-providers/sync/sync-status-tracker';

logger.info('Initializing Redis client...');

// Key prefix for test isolation - each Jest worker gets its own namespace
export const REDIS_KEY_PREFIX = process.env.JEST_WORKER_ID ? `${process.env.JEST_WORKER_ID}:` : undefined;

const redisOptions = {
  keyPrefix: REDIS_KEY_PREFIX,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  keepAlive: 10000,
  retryStrategy: (times: number) => Math.min(times * 100, 3000),
};

// Vercel Marketplace Redis providers expose a TLS URL; local/self-hosted installs
// can continue using APPLICATION_REDIS_HOST.
export const redisClient = process.env.APPLICATION_REDIS_URL
  ? new Redis(process.env.APPLICATION_REDIS_URL, redisOptions)
  : new Redis({
  host: process.env.APPLICATION_REDIS_HOST,
  ...redisOptions,
});

// ioredis emits error events that need handling to prevent crashes
redisClient.on('error', (error: Error) => {
  if (!error.message.includes('Connection is closed')) {
    logger.error({ message: 'Redis Client Error', error });
  }
});

// Promise that resolves when Redis is fully initialized (connected + cleanup done)
export const redisReady: Promise<void> = (async () => {
  const startTime = Date.now();
  await redisClient.connect();
  logger.info(`✅ App connected to Redis! Took: ${Date.now() - startTime}ms`);

  // Clear stale sync statuses from Redis on startup
  // Skip in test environment - handled by setupIntegrationTests.ts beforeEach
  if (process.env.NODE_ENV !== 'test' && process.env.VERCEL !== '1') {
    await clearAllSyncStatuses();
  }
})();

// Prevent unhandled rejection if connection fails before being awaited
redisReady.catch(() => {});
