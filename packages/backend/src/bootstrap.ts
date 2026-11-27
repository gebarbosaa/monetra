// Bootstrap file - loads env vars and initializes early services.
// This file must be imported first in app.ts.
import { initPostHog } from '@js/utils/posthog';
import { initSentry } from '@js/utils/sentry';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables first
const envPath = path.join(__dirname, `../../../.env.${process.env.NODE_ENV}`);
dotenv.config({ path: envPath });

// Normalize the managed Redis URL once so every BullMQ connection can use
// the same host, credentials and TLS settings without changing queue payloads.
const managedRedisUrl = process.env.APPLICATION_REDIS_URL;
if (managedRedisUrl) {
  const redisUrl = new URL(managedRedisUrl);
  process.env.APPLICATION_REDIS_HOST = redisUrl.hostname;
  process.env.APPLICATION_REDIS_PORT = redisUrl.port || '6379';
  process.env.APPLICATION_REDIS_USERNAME = decodeURIComponent(redisUrl.username);
  process.env.APPLICATION_REDIS_PASSWORD = decodeURIComponent(redisUrl.password);
  process.env.APPLICATION_REDIS_TLS = redisUrl.protocol === 'rediss:' ? 'true' : 'false';
}

// Initialize monitoring services early (after env vars are loaded)
// Note: imports are hoisted, but these function calls execute after dotenv.config()
initSentry();
initPostHog();
