import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, UserCog, Users } from "lucide-react";
import { requireRolePage } from "@/lib/auth";
import { listOrganizerApplications, listPriceRequests, listUsers } from "@/lib/admin";
import { listEventsForAdmin } from "@/lib/events";
import { formatDate, ROLE_LABEL } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { adminTabs } from "@/components/admin-tabs";
import { StatusBadge } from "@/components/status-badge";
import { UserAdminControls } from "@/components/admin-controls";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Users & access" };

const filters = [
  { key: "all", label: "All" },
  { key: "attendee", label: "Attendees" },
  { key: "organizer", label: "Organizers" },
  { key: "gate", label: "Gate staff" },
  { key: "admin", label: "Admins" },
];

const roleTone: Record<string, string> = {
  attendee: "bg-zinc-100 text-zinc-600 border border-zinc-200",
  organizer: "bg-violet-50 text-violet-700 border border-violet-200",
  gate: "bg-cyan-50 text-cyan-700 border border-cyan-200",
  admin: "bg-ink-950 text-white border border-ink-950",
  ceo: "bg-amber-50 text-amber-700 border border-amber-200",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string }>;
}) {
  const current = await requireRolePage(["admin", "ceo"]);
  const { role = "all", q = "" } = await searchParams;

  const users = listUsers();
  const query = q.trim().toLowerCase();
  const visible = users.filter((user) => {
    const matchesRole = role === "all" || user.role === role;
    const matchesQuery =
      !query ||
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      (user.city || "").toLowerCase().includes(query);
    return matchesRole && matchesQuery;
  });

  const pendingOrganizers = listOrganizerApplications("all").filter(
    (application) =>
      application.status === "pending" || application.status === "requires_modification",
  ).length;
  const pendingEvents = listEventsForAdmin("pending").length;
  const pendingPrices = listPriceRequests("pending").length;

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Governance console"
        title="Users & access"
        description="Review accounts, change roles and suspend access. Every change is written to the audit log."
        tabs={adminTabs({
          organizers: pendingOrganizers,
          events: pendingEvents,
          prices: pendingPrices,
        })}
      />

      <div className="container-page max-w-6xl pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="hide-scrollbar flex items-center gap-1 overflow-x-auto">
            {filters.map((item) => (
              <Link
                key={item.key}
                href={`/admin/users?role=${item.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                  role === item.key
                    ? "bg-ink-950 text-white"
                    : "border border-line bg-white text-ink-500 hover:text-ink-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <form action="/admin/users" className="flex items-center gap-1.5">
            <input type="hidden" name="role" value={role} />
            <input
              name="q"
              defaultValue={q}
              className="input w-[190px] py-1.5 text-[12px]"
              placeholder="Search name, email or city"
            />
            <button type="submit" className="btn btn-outline btn-sm">
              Search
            </button>
          </form>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {(["attendee", "organizer", "gate", "admin"] as const).map((key) => (
            <div key={key} className="rounded-xl border border-line bg-white px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                {ROLE_LABEL[key]}
              </p>
              <p className="mt-0.5 font-display text-[19px] font-semibold text-ink-950">
                {users.filter((user) => user.role === key).length}
              </p>
            </div>
          ))}
        </div>

        {visible.length ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
            <div className="hide-scrollbar overflow-x-auto">
              <table className="table-base min-w-[820px]">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Contact</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th className="text-right">Access</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((user) => (
                    <tr key={user.id} className="hover:bg-surface/40">
                      <td>
                        <p className="text-[12px] font-semibold text-ink-950">{user.name}</p>
                        <p className="font-mono text-[9.5px] text-ink-300">{user.id.slice(0, 14)}…</p>
                      </td>
                      <td>
                        <p className="text-[11px] text-ink-600">{user.email}</p>
                        <p className="text-[10px] text-ink-400">
                          {user.phone || "No phone"} · {user.city || "No city"}
                        </p>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            roleTone[user.role] || roleTone.attendee
                          }`}
                        >
                          {ROLE_LABEL[user.role] || user.role}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={user.status} />
                      </td>
                      <td className="text-[10.5px] text-ink-500">{formatDate(user.created_at)}</td>
                      <td>
                        <div className="flex justify-end">
                          <UserAdminControls
                            userId={user.id}
                            role={user.role}
                            status={user.status}
                            disabled={user.id === current.id}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No users match this view"
              description="Try a different role filter or clear the search query."
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-start gap-3 rounded-2xl border border-line bg-white px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <p className="text-[11px] leading-relaxed text-ink-500">
            You cannot change your own role or status. Elevated roles (administrator and CEO) grant
            platform-wide access — assign them only to trusted operators.
          </p>
          <UserCog className="ml-auto hidden h-4 w-4 text-ink-300 sm:block" />
        </div>

        <div className="mt-3 flex items-center justify-end">
          <Link href="/admin/audit" className="btn btn-ghost btn-sm">
            View audit log
          </Link>
        </div>
      </div>
    </div>
  );
}
