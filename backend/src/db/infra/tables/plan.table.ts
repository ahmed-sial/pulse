import { Generated } from 'kysely';
import { PlanTier } from '../../../configs/index.js';

export interface IPlanTable {
  id: Generated<string>;
  user_id: string;
  name: PlanTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  created_at: Generated<Date>;
  updated_at: Date | null;
}
