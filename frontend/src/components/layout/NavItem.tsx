import { NavLink } from "react-router-dom";

export function NavItem({
  to,
  label,
  icon: Icon,
  badge,
}: {
  to: string;
  label: string;
  icon: any;
  badge?: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
    >
      <Icon size={16} />
      <span>{label}</span>
      {badge && <em>{badge}</em>}
    </NavLink>
  );
}
