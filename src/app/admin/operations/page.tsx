import type { Metadata } from "next";
import Link from "next/link";
import { Link2, ScanLine, UsersRound, Wrench } from "lucide-react";
import { requireRolePage } from "@/lib/auth";
import {
  listAllStaffAssignments,
  listDevices,
  listOrganizerApplications,
  listPriceRequests,
} from "@/lib/admin";
import { listEventsForAdmin } from "@/lib/events";
import { getGateStaffOptions } from "@/lib/gate";
import { formatDate, formatDateTime } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { adminTabs } from "@/components/admin-tabs";
import {
  DeviceAssignForm,
  RemoveStaffButton,
  StaffAssignForm,
} from "@/components/admin-controls";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Operations" };

const deviceTone: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  maintenance: "bg-amber-50 text-amber-700 border border-amber-200",
  retired: "bg-zinc-100 text-zinc-600 border border-zinc-200",
};

export default async function AdminOperationsPage() {
  await requireRolePage(["admin", "ceo"]);

  const devices = listDevices();
  const assignments = listAllStaffAssignments();
  const staff = getGateStaffOptions();
  const events = listEventsForAdmin().map((event) => ({
    id: event.id,
    title: `${event.title} · ${formatDate(event.starts_at)}`,
  }));

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
        title="Operations"
        description="Provision scanning devices, assign gate staff and keep check-in coverage aligned to live events."
        tabs={adminTabs({
          organizers: pendingOrganizers,
          events: pendingEvents,
          prices: pendingPrices,
        })}
      />

      <div className="container-page max-w-6xl space-y-5 pt-6">
        <section className="rounded-2xl border border-line bg-white">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <h2 className="font-display text-[14px] font-semibold text-ink-950">Scanning devices</h2>
              <p className="mt-0.5 text-[11px] text-ink-400">
                Assign each device to an event and, optionally, a responsible staff member.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-ink-400">
              <Wrench className="h-3.5 w-3.5" /> {devices.length} devices
            </span>
          </header>

          {devices.length ? (
            <div className="divide-y divide-line">
              {devices.map((device) => (
                <div key={device.id} className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center">
                  <div className="min-w-0 lg:w-[240px]">
                    <div className="flex items-center gap-2">
                      <ScanLine className="h-4 w-4 text-brand-600" />
                      <p className="text-[12.5px] font-semibold text-ink-950">{device.name}</p>
                    </div>
                    <p className="mt-0.5 font-mono text-[9.5px] text-ink-400">{device.serial}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${
                          deviceTone[device.status] || deviceTone.retired
                        }`}
                      >
                        {device.status}
                      </span>
                      <span className="text-[9.5px] uppercase tracking-[0.08em] text-ink-300">
                        {device.type}
                      </span>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 text-[10.5px] text-ink-500">
                    <p>
                      <span className="text-ink-400">Event:</span>{" "}
                      <strong className="font-semibold text-ink-800">
                        {device.assigned_event_title || "Unassigned"}
                      </strong>
                    </p>
                    <p>
                      <span className="text-ink-400">Staff:</span>{" "}
                      <strong className="font-semibold text-ink-800">
                        {device.assigned_staff_name || "Unassigned"}
                      </strong>
                    </p>
                    <p className="text-[9.5px] text-ink-300">
                      Updated {formatDateTime(device.updated_at)}
                    </p>
                  </div>

                  <div className="lg:w-[430px]">
                    <DeviceAssignForm
                      deviceId={device.id}
                      eventId={device.assigned_event_id}
                      staffId={device.assigned_staff_id}
                      events={events}
                      staff={staff}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                icon={<ScanLine className="h-5 w-5" />}
                title="No devices registered"
                description="Add scanners to the estate before assigning gate teams."
              />
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-[14px] font-semibold text-ink-950">
                Assign gate staff
              </h2>
              <p className="mt-0.5 text-[11px] text-ink-400">
                Staff can only scan events they are assigned to. Gate name appears on every scan.
              </p>
            </div>
            <Link href="/admin/users" className="btn btn-ghost btn-sm">
              <UsersRound className="h-3.5 w-3.5" /> Manage roles
            </Link>
          </div>
          <div className="mt-3">
            <StaffAssignForm events={events} staff={staff} />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h2 className="font-display text-[14px] font-semibold text-ink-950">
                Current assignments
              </h2>
              <p className="mt-0.5 text-[11px] text-ink-400">
                {assignments.length} staff-to-event assignments
              </p>
            </div>
            <Link2 className="h-4 w-4 text-ink-300" />
          </header>

          {assignments.length ? (
            <div className="hide-scrollbar overflow-x-auto">
              <table className="table-base min-w-[720px]">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Staff member</th>
                    <th>Gate</th>
                    <th>Event date</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-surface/40">
                      <td className="text-[11.5px] font-semibold text-ink-950">
                        {assignment.event_title}
                      </td>
                      <td>
                        <p className="text-[11.5px]">{assignment.user_name}</p>
                        <p className="text-[10px] text-ink-400">{assignment.user_email}</p>
                      </td>
                      <td className="text-[11px] text-ink-600">{assignment.gate_name}</td>
                      <td className="text-[10.5px] text-ink-500">
                        {formatDate(assignment.event_starts_at)}
                      </td>
                      <td className="text-right">
                        <RemoveStaffButton assignmentId={assignment.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                icon={<UsersRound className="h-5 w-5" />}
                title="No gate teams yet"
                description="Assign gate staff to an event to enable scanning."
              />
            </div>
          )}
        </section>

        <p className="text-[10.5px] leading-relaxed text-ink-400">
          Device and staff changes are audited. Only active gate, administrator and CEO accounts can
          be assigned to scanning duty.
        </p>
      </div>
    </div>
  );
}
