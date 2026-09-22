export function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label>{label}</label>
      <b className="mono">{value}</b>
    </div>
  );
}
