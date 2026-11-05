import { waitUntil } from '@vercel/functions';
import { logger } from '../logging/logger.js';

/**
 * Safely registers a background promise using Vercel's `waitUntil()`.
 * If invoked outside a Vercel runtime (e.g. standalone server, local testing),
 * handles errors gracefully to prevent unhandled promise rejections.
 */
export function safeWaitUntil(promise: Promise<unknown>): void {
  const guardedPromise = promise.catch((err) => {
    logger.error(
      {
        processing_step: 'background_worker',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      'Unhandled error in background task execution'
    );
  });

  try {
    waitUntil(guardedPromise);
  } catch {
    // In environments where waitUntil is not available or throws outside request context
  }
}
