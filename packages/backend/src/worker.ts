import './app';

import { logger } from '@js/utils/logger';
import { redisClient, redisReady } from './redis-client';
import { initializeBackgroundJobs, shutdownBackgroundJobs } from './background-jobs';

async function startWorker(): Promise<void> {
  await redisReady;
  initializeBackgroundJobs();
  logger.info('MONETRA background worker is ready.');
}

async function stopWorker(signal: string): Promise<void> {
  logger.info(`Received ${signal}; stopping MONETRA background workers.`);
  try {
    await shutdownBackgroundJobs();
    await redisClient.quit();
    process.exit(0);
  } catch (error) {
    const errorToLog = error instanceof Error ? error : new Error(String(error));
    logger.error({ message: 'Failed to stop MONETRA background worker cleanly.', error: errorToLog });
    process.exit(1);
  }
}

process.once('SIGTERM', () => void stopWorker('SIGTERM'));
process.once('SIGINT', () => void stopWorker('SIGINT'));

void startWorker().catch((error) => {
  const errorToLog = error instanceof Error ? error : new Error(String(error));
  logger.error({ message: 'MONETRA background worker failed to start.', error: errorToLog });
  process.exit(1);
});
