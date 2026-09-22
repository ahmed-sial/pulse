import { volume } from "../../data/mockData";

export function MiniChart({ data = volume }: { data?: number[] }) {
  const max = Math.max(...data);
  return (
    <div className="mini-chart">
      {data.map((v, i) => (
        <i key={i} style={{ height: `${Math.max(12, (v / max) * 90)}%` }} />
      ))}
    </div>
  );
}
