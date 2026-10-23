import type { ReactNode } from "react";
import { formatMoney } from "@/lib/format";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "brand" | "dark";
}) {
  const styles =
    tone === "brand"
      ? "border-brand-200 bg-gradient-to-br from-brand-50 to-white"
      : tone === "dark"
        ? "border-ink-800 bg-ink-950 text-white"
        : "border-line bg-white";

  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <div className="flex items-center justify-between">
        <p
          className={`text-[11.5px] font-semibold uppercase tracking-[0.08em] ${
            tone === "dark" ? "text-white/50" : "text-ink-400"
          }`}
        >
          {label}
        </p>
        {icon ? (
          <span className={tone === "dark" ? "text-white/40" : "text-brand-600"}>{icon}</span>
        ) : null}
      </div>
      <p
        className={`mt-2.5 font-display text-[24px] font-semibold tracking-[-0.03em] ${
          tone === "dark" ? "text-white" : "text-ink-950"
        }`}
      >
        {value}
      </p>
      {hint ? (
        <p className={`mt-1 text-[11.5px] ${tone === "dark" ? "text-white/45" : "text-ink-400"}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function MoneyStat({
  label,
  cents,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  cents: number;
  hint?: string;
  tone?: "default" | "brand" | "dark";
  icon?: ReactNode;
}) {
  return <StatCard label={label} value={formatMoney(cents)} hint={hint} tone={tone} icon={icon} />;
}
