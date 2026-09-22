import { ArrowDown, ArrowUp } from "lucide-react";

export function Stat({
  label,
  value,
  change,
  icon: Icon,
  positive = true,
}: {
  label: string;
  value: string;
  change: string;
  icon: any;
  positive?: boolean;
}) {
  return (
    <div className="stat panel">
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={16} />
      </div>
      <strong>{value}</strong>
      <span className={positive ? "trend up" : "trend down"}>
        {positive ? <ArrowUp size={12} /> : <ArrowDown size={12} />} {change}
      </span>
      <span className="compare">vs. previous 24h</span>
    </div>
  );
}
