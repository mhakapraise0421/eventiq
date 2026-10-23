import type { ReactNode } from "react";
import { ConsoleTabs, type ConsoleTab } from "./console-tabs";

export function ConsoleHeader({
  eyebrow,
  title,
  description,
  tabs,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  tabs?: ConsoleTab[];
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-line bg-surface/70">
      <div className="container-page pb-4 pt-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.035em] text-ink-950 md:text-[34px]">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-500">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {tabs ? (
          <div className="mt-6">
            <ConsoleTabs tabs={tabs} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
