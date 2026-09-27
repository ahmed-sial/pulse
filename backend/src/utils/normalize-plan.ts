import { PlanTier } from '../configs/index.js';

export function normalizePlanTier(raw: string | undefined | null): PlanTier {
  const lower = raw?.toLowerCase();
  if (Object.values(PlanTier).includes(lower as PlanTier)) {
    return lower as PlanTier;
  }
  return PlanTier.FREE;
}
