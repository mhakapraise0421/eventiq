import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  DoorOpen,
  Link2,
  ScanLine,
  UsersRound,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react";
import { requireRolePage } from "@/lib/auth";
import {
  listAllStaffAssignments,
  listDevices,
  listOrganizerApplications,
  listPriceRequests,
} from "@/lib/admin";
import { listEventsForAdmin } from "@/lib/events";
import { listGates } from "@/lib/gates";
import { getGateStaffOptions } from "@/lib/gate";
import { formatDate, formatDateTime } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { adminTabs } from "@/components/admin-tabs";
import {
  DeviceAssignForm,
  RemoveStaffButton,
  StaffAssignForm,
} from "@/components/admin-controls";
import {
  DeviceCreateForm,
  DevicePairButton,
  GateCreateForm,
  GateStatusControl,
  PairingSafetyNote,
  RevokeDeviceButton,
} from "@/components/gate-controls";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Operations" };

const deviceTone: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  maintenance: "bg-amber-50 text-amber-700 border border-amber-200",
  retired: "bg-zinc-100 text-zinc-600 border border-zinc-200",
};

const gateTone: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  maintenance: "bg-amber-50 text-amber-700 border border-amber-200",
  closed: "bg-rose-50 text-rose-700 border border-rose-200",
};

const deviceTypeLabel: Record<string, string> = {
  scanner: "Scanner",
  gate_controller: "Gate controller",
  bridge: "Gate bridge",
  printer: "Printer",
  encoder: "Encoder",
};

const gateKindLabel: Record<string, string> = {
  turnstile: "Turnstile",
  overhead: "Overhead gate",
  handheld: "Handheld lane",
};

const directionLabel: Record<string, string> = {
  in: "Entry",
  out: "Exit",
  both: "Entry and exit",
};

export default async function AdminOperationsPage() {
  await requireRolePage(["admin", "ceo"]);

  const gates = listGates();
  const devices = listDevices();
  const assignments = listAllStaffAssignments();
  const staff = getGateStaffOptions();
  const events = listEventsForAdmin().map((event) => ({
    id: event.id,
    title: `${event.title} · ${formatDate(event.starts_at)}`,
  }));
  const gateOptions = gates.map((gate) => ({
    id: gate.id,
    name: gate.name,
    event_title: gate.event_title,
  }));

  const pendingOrganizers = listOrganizerApplications("all").filter(
    (application) =>
      application.status === "pending" || application.status === "requires_modification",
  ).length;
  const pendingEvents = listEventsForAdmin("pending").length;
  const pendingPrices = listPriceRequests("pending").length;
  const now = Date.now();

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Governance console"
        title="Operations"
        description="Provision gates and devices, pair scanning bridges and keep check-in coverage aligned to live events."
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
              <h2 className="font-display text-[14px] font-semibold text-ink-950">
                Gates &amp; controllers
              </h2>
              <p className="mt-0.5 text-[11px] text-ink-400">
                Each gate has a direction, open pulse and its own device keys.
              </p>
            </div>
            <Link href="/admin/operations/simulator" className="btn btn-outline btn-sm">
              <DoorOpen className="h-3.5 w-3.5" /> Virtual gate simulator
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </header>

          <div className="space-y-3 p-4">
            <PairingSafetyNote />
            <GateCreateForm events={events} />

            {gates.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {gates.map((gate) => (
                  <article key={gate.id} className="rounded-xl border border-line bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                          {gate.event_title || "Event"}
                        </p>
                        <h3 className="mt-0.5 truncate font-display text-[14px] font-semibold tracking-[-0.02em] text-ink-950">
                          {gate.name}
                        </h3>
                        <p className="mt-0.5 text-[10px] text-ink-400">
                          {gateKindLabel[gate.kind] || gate.kind} ·{" "}
                          {directionLabel[gate.direction] || gate.direction} · {gate.open_ms}ms pulse
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${
                          gateTone[gate.status] || gateTone.closed
                        }`}
                      >
                        {gate.status}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-surface px-2 py-1.5">
                        <p className="text-[9px] uppercase tracking-[0.08em] text-ink-400">
                          Devices
                        </p>
                        <p className="text-[14px] font-semibold text-ink-900">
                          {gate.device_count ?? 0}
                        </p>
                      </div>
                      <div className="rounded-lg bg-surface px-2 py-1.5">
                        <p className="text-[9px] uppercase tracking-[0.08em] text-ink-400">Paired</p>
                        <p className="text-[14px] font-semibold text-ink-900">
                          {gate.paired_count ?? 0}
                        </p>
                      </div>
                      <div className="rounded-lg bg-surface px-2 py-1.5">
                        <p className="text-[9px] uppercase tracking-[0.08em] text-ink-400">
                          Heartbeat
                        </p>
                        <p className="text-[14px] font-semibold text-ink-900">
                          {gate.online_count ?? 0}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <GateStatusControl gateId={gate.id} status={gate.status} />
                      <span className="text-[9px] text-ink-400">
                        {gate.last_seen_at
                          ? `Last seen ${formatDateTime(gate.last_seen_at)}`
                          : "No heartbeat yet"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<DoorOpen className="h-5 w-5" />}
                title="No gates yet"
                description="Create a gate above, then register and pair its controller."
              />
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <h2 className="font-display text-[14px] font-semibold text-ink-950">
                Scanning devices
              </h2>
              <p className="mt-0.5 text-[11px] text-ink-400">
                Register controllers, assign them to a gate and pair their key. The event follows
                the gate.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-ink-400">
              <Wrench className="h-3.5 w-3.5" /> {devices.length} devices
            </span>
          </header>

          <div className="space-y-3 p-4">
            <DeviceCreateForm gates={gateOptions} />

            {devices.length ? (
              <div className="divide-y divide-line border-t border-line">
                {devices.map((device) => {
                  const paired = !!device.api_key_hash;
                  const online = device.last_seen_at
                    ? now - new Date(device.last_seen_at).getTime() < 2 * 60 * 1000
                    : false;
                  return (
                    <div
                      key={device.id}
                      className="flex flex-col gap-3 py-3 lg:flex-row lg:items-start"
                    >
                      <div className="min-w-0 lg:w-[230px]">
                        <div className="flex items-center gap-2">
                          <ScanLine className="h-4 w-4 shrink-0 text-brand-600" />
                          <p className="truncate text-[12.5px] font-semibold text-ink-950">
                            {device.name}
                          </p>
                        </div>
                        <p className="mt-0.5 font-mono text-[9.5px] text-ink-400">{device.serial}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${
                              deviceTone[device.status] || deviceTone.retired
                            }`}
                          >
                            {device.status}
                          </span>
                          <span className="text-[9.5px] uppercase tracking-[0.08em] text-ink-300">
                            {deviceTypeLabel[device.type] || device.type}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 text-[10.5px] text-ink-500">
                        <p>
                          <span className="text-ink-400">Gate:</span>{" "}
                          <strong className="font-semibold text-ink-800">
                            {device.gate_name || "Unassigned"}
                          </strong>
                          {device.gate_status ? (
                            <span className="ml-1 text-[9px] uppercase tracking-[0.06em] text-ink-300">
                              {device.gate_status}
                            </span>
                          ) : null}
                        </p>
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
                        <p className="mt-1 inline-flex items-center gap-1 text-[9.5px]">
                          {online ? (
                            <Wifi className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <WifiOff className="h-3 w-3 text-ink-300" />
                          )}
                          {paired
                            ? `Key ${device.api_key_prefix || "issued"} · ${
                                device.last_seen_at
                                  ? `seen ${formatDateTime(device.last_seen_at)}`
                                  : "no heartbeat yet"
                              }`
                            : "Not paired — no device can authenticate yet"}
                        </p>
                      </div>

                      <div className="space-y-2 lg:w-[440px]">
                        <DeviceAssignForm
                          deviceId={device.id}
                          gateId={device.gate_id}
                          staffId={device.assigned_staff_id}
                          gates={gateOptions}
                          staff={staff}
                        />
                        <div className="flex flex-wrap items-start gap-3">
                          <div>
                            <DevicePairButton
                              deviceId={device.id}
                              paired={paired}
                              prefix={device.api_key_prefix}
                            />
                          </div>
                          <RevokeDeviceButton deviceId={device.id} paired={paired} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="pt-1">
                <EmptyState
                  icon={<ScanLine className="h-5 w-5" />}
                  title="No devices registered"
                  description="Add a controller or bridge to a gate before pairing it."
                />
              </div>
            )}
          </div>
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
          Device keys are stored as hashes, pairing codes expire after 10 minutes, and every gate
          change is audited. Physical gate control requires the Stage 3 venue bridge — the virtual
          gate simulator exercises the same device API without claiming hardware integration.
        </p>
      </div>
    </div>
  );
}
