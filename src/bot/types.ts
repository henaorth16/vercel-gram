import { Context } from 'grammy';
import { User } from '@prisma/client';
import type { Logger } from 'pino';
import type { UpdateMetadata } from '../logging/metadata.js';

export interface BotContext extends Context {
  dbUser?: User | null;
  getVercelToken?: () => string | null;
  updateMeta?: UpdateMetadata;
  logger?: Logger;
}
