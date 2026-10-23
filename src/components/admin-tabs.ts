import type { ConsoleTab } from "./console-tabs";

export function adminTabs(
  counts: { organizers?: number; events?: number; prices?: number } = {},
): ConsoleTab[] {
  return [
    { href: "/admin", label: "Overview" },
    { href: "/admin/organizers", label: "Organizers", count: counts.organizers },
    { href: "/admin/events", label: "Events", count: counts.events },
    { href: "/admin/price-requests", label: "Price requests", count: counts.prices },
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/operations", label: "Operations" },
    { href: "/admin/audit", label: "Audit log" },
  ];
}
