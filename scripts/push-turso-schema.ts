import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const url =
    process.env.TURSO_DATABASE_URL ||
    'libsql://vercel-gram-henaorth.aws-eu-central-1.turso.io';
  const authToken = process.env.TURSO_AUTH_TOKEN;

  console.log(`Connecting to Turso database: ${url}...`);

  if (!authToken) {
    console.error(
      '❌ Error: TURSO_AUTH_TOKEN is missing. Please add it to your .env file.'
    );
    process.exit(1);
  }

  const client = createClient({
    url,
    authToken,
  });

  const migrationPath = path.resolve(
    __dirname,
    '../prisma/migrations/20261104213224_init/migration.sql'
  );

  const sqlContent = fs.readFileSync(migrationPath, 'utf8');

  // Split SQL commands by semicolon
  const statements = sqlContent
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Applying ${statements.length} schema statements to Turso...`);

  for (const statement of statements) {
    try {
      await client.execute(statement);
    } catch (err: any) {
      if (err.message && err.message.includes('already exists')) {
        console.log(`ℹ️ Already exists: ${statement.slice(0, 30)}...`);
      } else {
        console.error('Error executing statement:', statement, err);
        throw err;
      }
    }
  }

  console.log('✅ Successfully applied schema to Turso database!');
}

main().catch((err) => {
  console.error('Failed to push schema to Turso:', err);
  process.exit(1);
});
