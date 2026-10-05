export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius)] bg-[var(--sky)] p-5">
      <span className="text-sm font-semibold text-[var(--navy-soft)]">{label}</span>
      <span className="font-mono text-3xl font-semibold text-[var(--fg)]">{value}</span>
      {hint ? <span className="text-xs text-[var(--navy-soft)]">{hint}</span> : null}
    </div>
  );
}
