import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('usage')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('user_id', 'text', (col) => col.notNull())
    .addColumn('events_usage', 'bigint', (col) => col.notNull().defaultTo(0))
    .addColumn('events_limit', 'bigint', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn('updated_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('idx_usage_user')
    .on('usage')
    .column('user_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('usage').execute();
}
