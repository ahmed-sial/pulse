import * as path from 'path';
import { promises as fs } from 'fs';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import dotenv from 'dotenv';
import { createDatabase } from './db.factory.js';

dotenv.config({
  quiet: true,
  path: path.resolve(import.meta.dirname, '../../../.env'),
});

async function migrateToLatest() {
  const connectionString = process.env.DB_URL;

  if (!connectionString) {
    throw new Error('DB_URL is required');
  }

  const db = await createDatabase(connectionString);

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.resolve(import.meta.dirname, './migrations'),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === 'Error') {
      console.error(`failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error('failed to migrate');
    console.error(error);
    process.exit(1);
  }

  await db.destroy();
}

void migrateToLatest();
