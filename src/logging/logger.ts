import pino from 'pino';
import { config } from '../config/index.js';
import { UpdateMetadata } from './metadata.js';

export interface StructuredLogContext {
  update_id?: string | number | bigint;
  chat_id?: string | number;
  command?: string;
  processing_step?: string;
  duration_ms?: number;
  error?: string;
  [key: string]: unknown;
}

export const logger = pino({
  level: config.NODE_ENV === 'test' ? 'silent' : process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    log(object: Record<string, unknown>) {
      // Serialize any BigInt values safely
      const cleanObj: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(object)) {
        if (typeof value === 'bigint') {
          cleanObj[key] = value.toString();
        } else {
          cleanObj[key] = value;
        }
      }
      return cleanObj;
    },
  },
  base: {
    service: 'vercel-telegram-bot',
  },
});

/**
 * Creates a child Pino logger bound to standard Telegram structured logging fields:
 * update_id, chat_id, command, processing_step.
 */
export function createUpdateLogger(meta: UpdateMetadata & { processing_step?: string }) {
  return logger.child({
    update_id: meta.update_id !== undefined ? String(meta.update_id) : undefined,
    chat_id: meta.chat_id,
    command: meta.command,
    processing_step: meta.processing_step,
  });
}
