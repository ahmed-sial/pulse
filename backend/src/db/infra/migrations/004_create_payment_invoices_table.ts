import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('payment_invoices')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('user_id', 'text', (col) => col.notNull())
    .addColumn('stripe_customer_id', 'text')
    .addColumn('stripe_subscription_id', 'text')
    .addColumn('stripe_invoice_id', 'text', (col) => col.notNull().unique())
    .addColumn('status', 'text')
    .addColumn('currency', 'text')
    .addColumn('amount_due', 'bigint')
    .addColumn('amount_paid', 'bigint')
    .addColumn('hosted_invoice_url', 'text')
    .addColumn('invoice_pdf', 'text')
    .addColumn('period_start', 'timestamptz')
    .addColumn('period_end', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn('updated_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('idx_payment_invoices_user')
    .on('payment_invoices')
    .column('user_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('payment_invoices').execute();
}
