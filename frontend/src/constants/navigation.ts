import {
  Activity,
  Bell,
  Code2,
  KeyRound,
  LayoutDashboard,
  Server,
  Settings as SettingsIcon,
  Zap,
} from "lucide-react";

export const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/logs", label: "Live logs", icon: Activity, badge: "LIVE" },
  { to: "/queries", label: "Saved queries", icon: Code2 },
  { to: "/services", label: "Services", icon: Server },
];
export const manage = [
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/integrations", label: "Integrations", icon: Zap },
  { to: "/api-keys", label: "API keys", icon: KeyRound },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];
