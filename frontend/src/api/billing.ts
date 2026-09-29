import { api } from "./axios";

export type PlanName = "free" | "starter" | "pro" | "business";
export type CurrentBilling = {
  plan: PlanName;
  usage: { eventsUsed: string; eventsLimit: string };
};
export type BillingPlan = {
  name: PlanName;
  eventsLimit: number;
  unitAmount: number | null;
  currency: string | null;
  interval: string | null;
  intervalCount: number | null;
};
export type BillingInvoice = {
  id: string;
  stripe_invoice_id: string;
  status: string | null;
  currency: string | null;
  amount_due: string | null;
  amount_paid: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  period_start: string | null;
  created_at: string;
};

const bearer = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
});

export const billingApi = {
  current: (token: string) =>
    api.get<CurrentBilling>("/billing/current", bearer(token)),
  plans: (token: string) =>
    api.get<{ plans: BillingPlan[] }>("/billing/plans", bearer(token)),
  invoices: (token: string) =>
    api.get<{ invoices: BillingInvoice[] }>("/billing/invoices", bearer(token)),
  checkout: (token: string, plan: Exclude<PlanName, "free">) =>
    api.post<{ url: string }>("/billing", { plan }, bearer(token)),
  portal: (token: string) =>
    api.post<{ url: string }>("/billing/portal", {}, bearer(token)),
  confirm: (token: string, sessionId?: string) =>
    api.post<{ status: "pending" | "confirmed"; plan?: PlanName }>(
      "/billing/confirm",
      sessionId ? { sessionId } : {},
      bearer(token),
    ),
};

export function formatEvents(value: string | number) {
  try {
    return BigInt(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export function formatMoney(
  cents: string | number | null,
  currency: string | null,
) {
  if (cents == null || !currency) return "—";
  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    });
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(Number(cents) / 10 ** digits);
  } catch {
    return `${cents} ${currency.toUpperCase()}`;
  }
}

export function externalBillingUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
