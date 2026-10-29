"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserRound,
} from "lucide-react";
import { ROLE_LABEL } from "@/lib/format";
import { consoleLink } from "@/lib/console-link";
import type { Role } from "@/lib/types";
import { useDismissable } from "./use-dismissable";

interface HeaderUser {
  name: string;
  email: string;
  role: Role;
}

type MenuId = "profile" | "nav";

export function HeaderMenus({ user }: { user: HeaderUser | null }) {
  // One shared state keeps the account dropdown and the mobile menu exclusive.
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const menusRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const navTriggerRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const closeMenu = useCallback(() => setOpenMenu(null), []);

  function toggle(next: MenuId) {
    lastTriggerRef.current = next === "profile" ? profileTriggerRef.current : navTriggerRef.current;
    setOpenMenu((current) => (current === next ? null : next));
  }

  useDismissable({
    open: openMenu !== null,
    onClose: closeMenu,
    containerRef: menusRef,
    restoreFocus: () => lastTriggerRef.current?.focus(),
  });

  // Collapsing into the desktop layout must not leave the mobile menu floating.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpenMenu((current) => (current === "nav" ? null : current));
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  const shortcut = user ? consoleLink(user.role) : null;
  const ShortcutIcon = shortcut?.icon;
  const initials = user
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
    : "";

  return (
    <div ref={menusRef} className="flex items-center gap-2.5">
      {user ? (
        <div className="relative">
          <button
            ref={profileTriggerRef}
            type="button"
            onClick={() => toggle("profile")}
            aria-expanded={openMenu === "profile"}
            aria-controls="header-profile-menu"
            aria-label={`Account menu for ${user.name}`}
            className="flex cursor-pointer items-center gap-2 rounded-full p-1 pr-2 transition hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-950 text-[12px] font-semibold text-white">
              {initials}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-ink-400 transition ${
                openMenu === "profile" ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>
          {openMenu === "profile" ? (
            <div
              id="header-profile-menu"
              className="absolute right-0 top-[calc(100%+10px)] w-64 overflow-hidden rounded-xl border border-line bg-white p-1.5 shadow-[0_18px_50px_rgba(8,8,13,0.14)]"
            >
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
                onClick={closeMenu}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface"
              >
                <Ticket className="h-4 w-4 text-ink-400" /> My tickets &amp; orders
              </Link>
              {shortcut ? (
                <Link
                  href={shortcut.href}
                  onClick={closeMenu}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface"
                >
                  {ShortcutIcon ? <ShortcutIcon className="h-4 w-4 text-ink-400" /> : null}
                  {shortcut.label}
                </Link>
              ) : null}
              <Link
                href="/dashboard/profile"
                onClick={closeMenu}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface"
              >
                <UserRound className="h-4 w-4 text-ink-400" /> Profile settings
              </Link>
              <Link
                href="/security"
                onClick={closeMenu}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface"
              >
                <ShieldCheck className="h-4 w-4 text-ink-400" /> Security &amp; sessions
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
          ) : null}
        </div>
      ) : null}

      <div className="relative lg:hidden">
        <button
          ref={navTriggerRef}
          type="button"
          onClick={() => toggle("nav")}
          aria-expanded={openMenu === "nav"}
          aria-controls="header-mobile-menu"
          aria-label="Main menu"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-ink-700 transition hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        {openMenu === "nav" ? (
          <nav
            id="header-mobile-menu"
            aria-label="Main menu"
            className="absolute right-0 top-[calc(100%+10px)] w-60 overflow-hidden rounded-xl border border-line bg-white p-1.5 shadow-[0_18px_50px_rgba(8,8,13,0.14)]"
          >
            <Link
              href="/events"
              onClick={closeMenu}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-surface"
            >
              <Search className="h-4 w-4 text-ink-400" /> Discover events
            </Link>
            <Link
              href="/artists"
              onClick={closeMenu}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-surface"
            >
              <Mic className="h-4 w-4 text-ink-400" /> Artist directory
            </Link>
            <Link
              href="/organizer/apply"
              onClick={closeMenu}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-surface"
            >
              <Sparkles className="h-4 w-4 text-ink-400" /> For organizers
            </Link>
            <Link
              href="/artist/apply"
              onClick={closeMenu}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-surface"
            >
              <Mic className="h-4 w-4 text-ink-400" /> For artists
            </Link>
            <Link
              href="/dashboard"
              onClick={closeMenu}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-surface"
            >
              <LayoutDashboard className="h-4 w-4 text-ink-400" /> My account
            </Link>
            <Link
              href="/policies"
              onClick={closeMenu}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-surface"
            >
              <ShieldCheck className="h-4 w-4 text-ink-400" /> Support &amp; policies
            </Link>
            {!user ? (
              <div className="mt-1 grid grid-cols-2 gap-1.5 border-t border-line p-1.5 pt-2.5">
                <Link href="/login" onClick={closeMenu} className="btn btn-outline btn-sm">
                  Sign in
                </Link>
                <Link href="/register" onClick={closeMenu} className="btn btn-primary btn-sm">
                  Register
                </Link>
              </div>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
