import Link from "next/link";
import { Search } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { consoleLink } from "@/lib/console-link";
import { HeaderMenus } from "./header-menus";
import { Logo } from "./logo";

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
            <Link href="/artists" className="transition-colors hover:text-ink-950">
              Artists
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
            <Link
              href={shortcut?.href || "/dashboard"}
              className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-2 text-[13px] font-semibold text-ink-700 transition hover:border-ink-300 sm:flex"
            >
              {ShortcutIcon ? <ShortcutIcon className="h-3.5 w-3.5" /> : null}
              {shortcut?.label || "Dashboard"}
            </Link>
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

          <HeaderMenus
            user={user ? { name: user.name, email: user.email, role: user.role } : null}
          />
        </div>
      </div>
    </header>
  );
}
