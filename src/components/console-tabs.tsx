"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ConsoleTab {
  href: string;
  label: string;
  count?: number;
}

export function ConsoleTabs({ tabs }: { tabs: ConsoleTab[] }) {
  const pathname = usePathname();

  return (
    <div className="hide-scrollbar -mx-1 overflow-x-auto">
      <nav className="flex min-w-max items-center gap-1 px-1">
        {tabs.map((tab) => {
          const isRoot = /^\/(organizer|admin|dashboard)$/.test(tab.href);
          const active = isRoot
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                active
                  ? "bg-white text-ink-950 shadow-sm ring-1 ring-line"
                  : "text-ink-500 hover:bg-white/70 hover:text-ink-900"
              }`}
            >
              {tab.label}
              {typeof tab.count === "number" && tab.count > 0 ? (
                <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[9.5px] font-bold text-white">
                  {tab.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
