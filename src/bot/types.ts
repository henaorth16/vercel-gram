import { Context } from 'grammy';
import { User } from '@prisma/client';

export interface BotContext extends Context {
  dbUser?: User | null;
  getVercelToken?: () => string | null;
}
