import { Activity, ChevronDown, Loader, MoreHorizontal, X } from "lucide-react";
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
            <b>68%</b>
          </div>
          <div className="usage-track">
            <i />
          </div>
          <small>680k of 1M events</small>
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
