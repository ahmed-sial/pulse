import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, CreditCard, Loader, RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHead } from "../components/common/PageHead";
import { useApi } from "../hooks/useApi";
import { getApiErrorMessage } from "../lib/apiError";
import {
  billingApi,
  externalBillingUrl,
  formatEvents,
  formatMoney,
  type BillingInvoice,
  type BillingPlan,
  type CurrentBilling,
  type PlanName,
} from "../api/billing";

const titles: Record<PlanName, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

function dateLabel(date: string | null) {
  if (!date) return "—";
  const time = new Date(date);
  return Number.isNaN(time.getTime()) ? "—" : time.toLocaleDateString();
}

export function Billing() {
  const { authRequest } = useApi();
  const [params, setParams] = useSearchParams();
  const [current, setCurrent] = useState<CurrentBilling | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmationState, setConfirmationState] = useState<
    "checking" | "pending" | "error" | null
  >(null);
  const [confirmationError, setConfirmationError] = useState("");
  const [confirmationRetry, setConfirmationRetry] = useState(0);
  const checkout = params.get("checkout");
  const sessionId = params.get("session_id");

  const refresh = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      const results = await Promise.allSettled([
        authRequest((token) => billingApi.current(token)),
        authRequest((token) => billingApi.plans(token)),
        authRequest((token) => billingApi.invoices(token)),
      ]);
      const failures: string[] = [];
      if (results[0].status === "fulfilled") setCurrent(results[0].value.data);
      else
        failures.push(`Current plan: ${getApiErrorMessage(results[0].reason)}`);
      if (results[1].status === "fulfilled")
        setPlans(results[1].value.data.plans);
      else
        failures.push(
          `Available plans: ${getApiErrorMessage(results[1].reason)}`,
        );
      if (results[2].status === "fulfilled")
        setInvoices(results[2].value.data.invoices);
      else failures.push(`Invoices: ${getApiErrorMessage(results[2].reason)}`);
      setErrors(failures);
      setLoading(false);
    },
    [authRequest],
  );

  useEffect(() => {
    void refresh(true);
  }, [refresh]);
  useEffect(() => {
    if (checkout === "cancelled") {
      toast.info("Checkout cancelled. No changes were made.");
      const next = new URLSearchParams(params);
      next.delete("checkout");
      setParams(next, { replace: true });
    }
  }, [checkout, params, setParams]);

  useEffect(() => {
    if (checkout !== "success") return;
    let cancelled = false;
    const confirm = async () => {
      setConfirmationState("checking");
      setConfirmationError("");
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          const response = await authRequest((token) =>
            billingApi.confirm(token, sessionId ?? undefined),
          );
          if (cancelled) return;
          if (response.data.status === "confirmed") {
            await refresh(true);
            if (cancelled) return;
            setConfirmationState(null);
            toast.success(
              `${titles[response.data.plan ?? "free"]} plan is active.`,
            );
            const next = new URLSearchParams(params);
            next.delete("checkout");
            next.delete("session_id");
            setParams(next, { replace: true });
            return;
          }
        } catch (error) {
          if (cancelled) return;
          setConfirmationError(getApiErrorMessage(error));
          setConfirmationState("error");
          return;
        }
        if (attempt < 5)
          await new Promise((resolve) => setTimeout(resolve, 1500));
        if (cancelled) return;
      }
      setConfirmationState("pending");
    };
    void confirm();
    return () => {
      cancelled = true;
    };
  }, [
    checkout,
    sessionId,
    confirmationRetry,
    authRequest,
    refresh,
    params,
    setParams,
  ]);

  async function redirectToBilling(kind: "portal" | Exclude<PlanName, "free">) {
    setPending(kind);
    try {
      const response = await authRequest((token) =>
        kind === "portal"
          ? billingApi.portal(token)
          : billingApi.checkout(token, kind),
      );
      const url = externalBillingUrl(response.data.url);
      if (!url) throw new Error("Billing provider returned an invalid URL.");
      window.location.assign(url);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
      setPending(null);
    }
  }

  async function syncSubscription() {
    setPending("sync");
    try {
      const response = await authRequest((token) => billingApi.confirm(token));
      await refresh(true);
      if (response.data.status === "confirmed")
        toast.success(
          `${titles[response.data.plan ?? "free"]} plan is active.`,
        );
      else
        toast.info(
          "Stripe has not marked a subscription active for this account yet.",
        );
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setPending(null);
    }
  }

  const used = Number(current?.usage.eventsUsed ?? 0);
  const limit = Number(current?.usage.eventsLimit ?? 0);
  const percent =
    limit > 0 ? Math.min(100, Math.max(0, (used / limit) * 100)) : 0;

  return (
    <>
      <PageHead
        title="Billing & plan"
        description="See your event allowance, change your plan, and view invoices."
        action={
          <button
            className="btn secondary"
            onClick={() => void refresh(true)}
            disabled={loading}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />
      {confirmationState && (
        <div
          className={`panel ${confirmationState === "error" ? "billing-error" : "billing-status"}`}
          role="status"
        >
          <p>
            {confirmationState === "checking"
              ? "Checking your subscription with Stripe…"
              : confirmationState === "pending"
                ? "Stripe has not marked the subscription active yet. Check again shortly."
                : `Could not check your subscription: ${confirmationError}`}
          </p>
          {confirmationState !== "checking" && (
            <button
              className="btn secondary"
              onClick={() => setConfirmationRetry((count) => count + 1)}
            >
              Check again
            </button>
          )}
        </div>
      )}
      {errors.length > 0 && (
        <div className="panel billing-error" role="alert">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
          <button className="btn secondary" onClick={() => void refresh(true)}>
            Try again
          </button>
        </div>
      )}
      {loading && !current && plans.length === 0 ? (
        <div className="loader-container">
          <Loader className="spinner" />
        </div>
      ) : (
        <>
          <section className="panel billing-summary">
            <div>
              <span className="billing-label">Current plan</span>
              <h2>{current ? titles[current.plan] : "Unavailable"}</h2>
              <p>
                {current
                  ? "Your plan is determined by your confirmed subscription."
                  : "Could not load your plan."}
              </p>
            </div>
            {current && (
              <div className="billing-usage">
                <div>
                  <span>Events used</span>
                  <strong>
                    {formatEvents(current.usage.eventsUsed)} /{" "}
                    {formatEvents(current.usage.eventsLimit)}
                  </strong>
                </div>
                <div className="usage-track">
                  <i style={{ width: `${percent}%` }} />
                </div>
                <small>{Math.round(percent)}% of your allowance used</small>
              </div>
            )}
            {current && current.plan !== "free" && (
              <button
                className="btn secondary"
                disabled={pending !== null}
                onClick={() => void redirectToBilling("portal")}
              >
                <CreditCard size={15} />{" "}
                {pending === "portal" ? "Opening…" : "Manage subscription"}
              </button>
            )}
            {current?.plan === "free" && (
              <button
                className="btn secondary"
                disabled={pending !== null}
                onClick={() => void syncSubscription()}
              >
                <RefreshCw size={15} />{" "}
                {pending === "sync" ? "Checking…" : "Already paid? Sync plan"}
              </button>
            )}
          </section>
          <section className="billing-section">
            <h2>Available plans</h2>
            <div className="billing-plans">
              {plans.map((plan) => {
                const selected = current?.plan === plan.name;
                return (
                  <article
                    className={`panel billing-tier ${selected ? "selected" : ""}`}
                    key={plan.name}
                  >
                    <div className="billing-tier-top">
                      <h3>{titles[plan.name]}</h3>
                      {selected && (
                        <span className="plan-badge">Current plan</span>
                      )}
                    </div>
                    <div className="billing-price">
                      {plan.name === "free"
                        ? "Free"
                        : formatMoney(plan.unitAmount, plan.currency)}
                      {plan.interval && (
                        <small>
                          {" "}
                          /{" "}
                          {plan.intervalCount && plan.intervalCount > 1
                            ? `${plan.intervalCount} `
                            : ""}
                          {plan.interval}
                          {plan.intervalCount && plan.intervalCount > 1
                            ? "s"
                            : ""}
                        </small>
                      )}
                    </div>
                    <p>{formatEvents(plan.eventsLimit)} events per allowance</p>
                    {plan.name === "free" ? (
                      <button className="btn secondary" disabled>
                        Included
                      </button>
                    ) : selected ? (
                      <button className="btn secondary" disabled>
                        Current plan
                      </button>
                    ) : current && current.plan !== "free" ? (
                      <button
                        className="btn secondary"
                        disabled={pending !== null}
                        onClick={() => void redirectToBilling("portal")}
                      >
                        Change in billing portal <ArrowUpRight size={14} />
                      </button>
                    ) : (
                      <button
                        className="btn primary"
                        disabled={
                          pending !== null ||
                          !current ||
                          plan.unitAmount == null ||
                          !plan.interval
                        }
                        onClick={() =>
                          void redirectToBilling(
                            plan.name as Exclude<PlanName, "free">,
                          )
                        }
                      >
                        {pending === plan.name
                          ? "Opening…"
                          : `Choose ${titles[plan.name]}`}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
          <section className="panel billing-invoices">
            <div className="table-title">
              <h2>Invoices</h2>
              <span>{invoices.length} invoices</span>
            </div>
            {invoices.length === 0 ? (
              <p className="billing-empty">No invoices yet.</p>
            ) : (
              <div className="table-scroll">
                <table className="key-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Invoice</th>
                      <th>Period starts</th>
                      <th>Status</th>
                      <th>Amount paid</th>
                      <th>Links</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => {
                      const hosted = externalBillingUrl(
                        invoice.hosted_invoice_url,
                      );
                      const pdf = externalBillingUrl(invoice.invoice_pdf);
                      return (
                        <tr key={invoice.id}>
                          <td>{dateLabel(invoice.created_at)}</td>
                          <td className="mono">{invoice.stripe_invoice_id}</td>
                          <td>{dateLabel(invoice.period_start)}</td>
                          <td>{invoice.status ?? "—"}</td>
                          <td>
                            {formatMoney(invoice.amount_paid, invoice.currency)}
                          </td>
                          <td className="billing-links">
                            {hosted && (
                              <a
                                href={hosted}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View <ArrowUpRight size={13} />
                              </a>
                            )}
                            {pdf && (
                              <a
                                href={pdf}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                PDF <ArrowUpRight size={13} />
                              </a>
                            )}
                            {!hosted && !pdf && "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
