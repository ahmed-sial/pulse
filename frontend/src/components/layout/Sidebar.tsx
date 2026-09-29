import { Activity, ChevronDown, Loader, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  billingApi,
  formatEvents,
  type CurrentBilling,
} from "../../api/billing";
import { useApi } from "../../hooks/useApi";
import { manage, nav } from "../../constants/navigation";
import { NavItem } from "./NavItem";
import { UserButton, useUser } from "@clerk/react";

export function Sidebar({
  mobileNav,
  close,
}: {
  mobileNav: boolean;
  close: () => void;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { authRequest } = useApi();
  const [billing, setBilling] = useState<CurrentBilling | null>(null);
  useEffect(() => {
    if (!isSignedIn) {
      setBilling(null);
      return;
    }
    let active = true;
    authRequest((token) => billingApi.current(token))
      .then((response) => {
        if (active) setBilling(response.data);
      })
      .catch(() => {
        if (active) setBilling(null);
      });
    return () => {
      active = false;
    };
  }, [authRequest, isSignedIn]);
  const used = Number(billing?.usage.eventsUsed ?? 0);
  const limit = Number(billing?.usage.eventsLimit ?? 0);
  const percent =
    limit > 0 ? Math.min(100, Math.max(0, (used / limit) * 100)) : 0;
  return (
    <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
      <div className="brand">
        <span className="brand-mark">
          <Activity size={17} />
        </span>
        <span>Pulse</span>
        <span className="brand-pro">DEV</span>
        <button className="mobile-close" onClick={close}>
          <X size={17} />
        </button>
      </div>
      <div className="workspace">
        <div className="workspace-dot">P</div>
        <div>
          <b>pulse-platform</b>
          <span>Production workspace</span>
        </div>
        <ChevronDown size={15} />
      </div>
      <div className="side-label">Monitor</div>
      <nav>
        {nav.map((n) => (
          <NavItem key={n.to} {...n} />
        ))}
      </nav>
      <div className="side-label">Configure</div>
      <nav>
        {manage.map((n) => (
          <NavItem key={n.to} {...n} />
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="usage">
          <div>
            <span>Log volume</span>
            <b>{billing ? `${Math.round(percent)}%` : "—"}</b>
          </div>
          <div className="usage-track">
            <i style={{ width: `${percent}%` }} />
          </div>
          <small>
            {billing
              ? `${formatEvents(billing.usage.eventsUsed)} of ${formatEvents(billing.usage.eventsLimit)} events`
              : "Usage unavailable"}
          </small>
        </div>
        {isLoaded === true ? (
          <div className="user-row">
            <UserButton />
            {user?.fullName}
          </div>
        ) : (
          <div>
            <Loader className="spinner" />
          </div>
        )}
      </div>
    </aside>
  );
}
