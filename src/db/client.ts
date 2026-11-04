import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { config } from '../config/index.js';

function initPrisma(): PrismaClient {
  const tursoUrl =
    config.TURSO_DATABASE_URL ||
    (config.DATABASE_URL.startsWith('libsql://') ? config.DATABASE_URL : null);

  if (tursoUrl) {
    const adapter = new PrismaLibSql({
      url: tursoUrl,
      authToken: config.TURSO_AUTH_TOKEN,
    });

    return new PrismaClient({ adapter });
  }

  return new PrismaClient({
    log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma || initPrisma();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
