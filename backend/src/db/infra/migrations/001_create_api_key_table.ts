import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('api_keys')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('user_id', 'text', (col) => col.notNull())
    .addColumn('api_name', 'varchar(32)', (col) => col.notNull())
    .addColumn('prefix', 'varchar(13)', (col) => col.notNull())
    .addColumn('hashed_key', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn('last_used_at', 'timestamptz')
    .addColumn('revoked_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('idx_api_keys_user')
    .on('api_keys')
    .column('user_id')
    .execute();
  await db.schema
    .createIndex('idx_api_key_hash')
    .on('api_keys')
    .column('hashed_key')
    .unique()
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('api_keys').execute();
}
