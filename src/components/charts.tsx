import { formatMoney } from "@/lib/format";

export function BarChart({
  data,
  valueKey = "value",
  labelKey = "label",
  currency = true,
  height = 180,
}: {
  data: Array<Record<string, string | number>>;
  valueKey?: string;
  labelKey?: string;
  currency?: boolean;
  height?: number;
}) {
  const values = data.map((d) => Number(d[valueKey] || 0));
  const max = Math.max(...values, 1);
  const barArea = height - 26;

  return (
    <div className="w-full">
      <div className="flex items-end gap-2.5" style={{ height }}>
        {data.map((item, index) => {
          const value = Number(item[valueKey] || 0);
          const barHeight = Math.max(4, Math.round((value / max) * barArea));
          return (
            <div key={index} className="flex flex-1 flex-col items-center justify-end gap-2">
              <span className="text-[10px] font-semibold text-ink-500">
                {value > 0 ? (currency ? formatMoney(value) : value) : ""}
              </span>
              <div
                className="w-full max-w-[46px] rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400 transition-all"
                style={{ height: barHeight }}
                title={`${item[labelKey]}: ${currency ? formatMoney(value) : value}`}
              />
              <span className="text-[10.5px] font-medium text-ink-400">{item[labelKey]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  tone = "brand",
}: {
  value: number;
  max: number;
  tone?: "brand" | "emerald" | "amber";
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  const color =
    tone === "emerald" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-brand-600";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
