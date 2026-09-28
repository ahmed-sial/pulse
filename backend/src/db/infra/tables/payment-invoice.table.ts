import { Generated } from 'kysely';

export interface IPaymentInvoicesTable {
  id: Generated<string>;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_invoice_id: string;
  status: string | null;
  currency: string | null;
  amount_due: bigint | null;
  amount_paid: bigint | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  period_start: Date | null;
  period_end: Date | null;
  created_at: Generated<Date>;
  updated_at: Date | null;
}
