import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  icon,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-14 text-center">
      {icon ? (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-line">
          {icon}
        </div>
      ) : null}
      <p className="font-display text-[15px] font-semibold text-ink-950">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-400">{description}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="btn btn-primary btn-sm mt-5">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
