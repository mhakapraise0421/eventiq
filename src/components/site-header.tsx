import Link from "next/link";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserRound,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/format";
import { Logo } from "./logo";

function consoleLink(role: string) {
  if (role === "organizer") return { href: "/organizer", label: "Organizer dashboard", icon: Sparkles };
  if (role === "gate") return { href: "/scan", label: "Gate scanner", icon: ScanLine };
  if (role === "admin" || role === "ceo") return { href: "/admin", label: "Admin console", icon: ShieldCheck };
  return { href: "/dashboard", label: "My tickets", icon: Ticket };
}

export async function SiteHeader() {
  const user = await getCurrentUser();
  const shortcut = user ? consoleLink(user.role) : null;
  const ShortcutIcon = shortcut?.icon;

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-white/85 backdrop-blur-xl">
      <div className="container-page flex h-[68px] items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-6 text-[13.5px] font-medium text-ink-500 lg:flex">
            <Link href="/events" className="transition-colors hover:text-ink-950">
              Discover
            </Link>
            <Link href="/events?date=week" className="transition-colors hover:text-ink-950">
              This week
            </Link>
            <Link href="/organizer/apply" className="transition-colors hover:text-ink-950">
              For organizers
            </Link>
            <Link href="/policies" className="transition-colors hover:text-ink-950">
              Support
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/events"
            className="hidden h-9 w-9 items-center justify-center rounded-full text-ink-500 transition hover:bg-surface hover:text-ink-950 sm:flex"
            aria-label="Search events"
          >
            <Search className="h-4 w-4" />
          </Link>

          {user ? (
            <>
              <Link
                href={shortcut?.href || "/dashboard"}
                className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-2 text-[13px] font-semibold text-ink-700 transition hover:border-ink-300 sm:flex"
              >
                {ShortcutIcon ? <ShortcutIcon className="h-3.5 w-3.5" /> : null}
                {shortcut?.label || "Dashboard"}
              </Link>

              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full p-1 pr-2 transition hover:bg-surface [&::-webkit-details-marker]:hidden">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-950 text-[12px] font-semibold text-white">
                    {user.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-ink-400 transition group-open:rotate-180" />
                </summary>
                <div className="absolute right-0 top-[calc(100%+10px)] w-64 overflow-hidden rounded-xl border border-line bg-white p-1.5 shadow-[0_18px_50px_rgba(8,8,13,0.14)]">
                  <div className="px-3 py-2.5">
                    <p className="truncate text-sm font-semibold text-ink-950">{user.name}</p>
                    <p className="truncate text-[12px] text-ink-400">{user.email}</p>
                    <span className="mt-1.5 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                      {ROLE_LABEL[user.role] || user.role}
                    </span>
                  </div>
                  <div className="my-1 h-px bg-line" />
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface"
                  >
                    <Ticket className="h-4 w-4 text-ink-400" /> My tickets & orders
                  </Link>
                  {shortcut ? (
                    <Link
                      href={shortcut.href}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface"
                    >
                      {ShortcutIcon ? <ShortcutIcon className="h-4 w-4 text-ink-400" /> : null}
                      {shortcut.label}
                    </Link>
                  ) : null}
                  <Link
                    href="/dashboard/profile"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface"
                  >
                    <UserRound className="h-4 w-4 text-ink-400" /> Profile settings
                  </Link>
                  <div className="my-1 h-px bg-line" />
                  <form action="/api/auth/logout" method="post">
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className="btn btn-ghost btn-sm">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Create account
              </Link>
            </div>
          )}

          <details className="group relative lg:hidden">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full text-ink-700 transition hover:bg-surface [&::-webkit-details-marker]:hidden">
              <Menu className="h-5 w-5" />
            </summary>
            <div className="absolute right-0 top-[calc(100%+10px)] w-60 overflow-hidden rounded-xl border border-line bg-white p-1.5 shadow-[0_18px_50px_rgba(8,8,13,0.14)]">
              <Link href="/events" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-surface">
                <Search className="h-4 w-4 text-ink-400" /> Discover events
              </Link>
              <Link href="/organizer/apply" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-surface">
                <Sparkles className="h-4 w-4 text-ink-400" /> For organizers
              </Link>
              <Link href="/dashboard" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-surface">
                <LayoutDashboard className="h-4 w-4 text-ink-400" /> My account
              </Link>
              <Link href="/policies" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-surface">
                <ShieldCheck className="h-4 w-4 text-ink-400" /> Support & policies
              </Link>
              {!user ? (
                <div className="mt-1 grid grid-cols-2 gap-1.5 border-t border-line p-1.5 pt-2.5">
                  <Link href="/login" className="btn btn-outline btn-sm">
                    Sign in
                  </Link>
                  <Link href="/register" className="btn btn-primary btn-sm">
                    Register
                  </Link>
                </div>
              ) : null}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
