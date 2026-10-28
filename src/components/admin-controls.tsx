"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleAlert,
  Pause,
  Play,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { ROLE_LABEL } from "@/lib/format";
import type { Role } from "@/lib/types";

async function postJson(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as { error?: string };
  if (!response.ok) return { ok: false as const, error: data.error || "Request failed." };
  return { ok: true as const };
}

function Feedback({ error, done }: { error: string; done: string }) {
  if (error) return <p className="mt-1 text-[10.5px] text-rose-600">{error}</p>;
  if (done) return <p className="mt-1 text-[10.5px] text-emerald-600">{done}</p>;
  return null;
}

export function OrganizerDecision({ userId }: { userId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function decide(decision: "approved" | "requires_modification" | "rejected") {
    setBusy(decision);
    setError("");
    setDone("");
    const result = await postJson("/api/admin/organizers/decide", {
      userId,
      decision,
      note,
    });
    if (!result.ok) {
      setError(result.error);
    } else {
      setDone("Decision saved.");
      router.refresh();
    }
    setBusy("");
  }

  return (
    <div className="mt-3 space-y-2">
      <input
        className="input text-[12px]"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Reviewer note (required for changes or rejection)"
      />
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => decide("approved")}
          className="btn btn-primary btn-sm"
          disabled={!!busy}
        >
          <Check className="h-3.5 w-3.5" /> {busy === "approved" ? "Approving…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => decide("requires_modification")}
          className="btn btn-outline btn-sm"
          disabled={!!busy}
        >
          <CircleAlert className="h-3.5 w-3.5" /> Request changes
        </button>
        <button
          type="button"
          onClick={() => decide("rejected")}
          className="btn btn-ghost btn-sm text-rose-600"
          disabled={!!busy}
        >
          <X className="h-3.5 w-3.5" /> Reject
        </button>
      </div>
      <Feedback error={error} done={done} />
    </div>
  );
}

export function EventDecision({
  eventId,
  status,
}: {
  eventId: string;
  status: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function decide(decision: "approved" | "rejected" | "cancelled") {
    if (decision !== "approved" && !reason.trim()) {
      setError("Add a reason before rejecting or cancelling.");
      return;
    }
    if (decision === "cancelled" && !window.confirm("Cancel this event? Its tickets will no longer be valid for entry.")) {
      return;
    }
    setBusy(decision);
    setError("");
    setDone("");
    const result = await postJson("/api/admin/events/decide", {
      eventId,
      decision,
      reason,
    });
    if (!result.ok) {
      setError(result.error);
    } else {
      setDone("Decision saved.");
      router.refresh();
    }
    setBusy("");
  }

  return (
    <div className="mt-3 space-y-2">
      {status === "pending" ? (
        <>
          <input
            className="input text-[12px]"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason (required for rejection)"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => decide("approved")}
              disabled={!!busy}
            >
              <Check className="h-3.5 w-3.5" /> {busy === "approved" ? "Publishing…" : "Approve & publish"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-rose-600"
              onClick={() => decide("rejected")}
              disabled={!!busy}
            >
              <X className="h-3.5 w-3.5" /> Reject
            </button>
          </div>
        </>
      ) : null}
      {status === "approved" ? (
        <>
          <input
            className="input text-[12px]"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for cancelling (required)"
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm text-rose-600"
            onClick={() => decide("cancelled")}
            disabled={!!busy}
          >
            <Pause className="h-3.5 w-3.5" /> Cancel event
          </button>
        </>
      ) : null}
      <Feedback error={error} done={done} />
    </div>
  );
}

export function PriceDecision({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function decide(decision: "approved" | "rejected") {
    setBusy(decision);
    setError("");
    setDone("");
    const result = await postJson("/api/admin/price-requests/decide", {
      requestId,
      decision,
      note,
    });
    if (!result.ok) {
      setError(result.error);
    } else {
      setDone(decision === "approved" ? "Price updated." : "Request rejected.");
      router.refresh();
    }
    setBusy("");
  }

  return (
    <div className="space-y-2">
      <input
        className="input text-[11.5px]"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Decision note (optional)"
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => decide("approved")}
          disabled={!!busy}
        >
          <Check className="h-3.5 w-3.5" /> Approve
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm text-rose-600"
          onClick={() => decide("rejected")}
          disabled={!!busy}
        >
          <X className="h-3.5 w-3.5" /> Reject
        </button>
      </div>
      <Feedback error={error} done={done} />
    </div>
  );
}

export function RefundButton({ orderId, reference }: { orderId: string; reference: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function refund() {
    if (!window.confirm(`Refund order ${reference}? This voids all unused tickets.`)) return;
    setBusy(true);
    setError("");
    const result = await postJson("/api/admin/orders/refund", { orderId });
    if (!result.ok) {
      setError(result.error);
    } else {
      setDone("Refunded.");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={refund}
        className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-rose-600"
        disabled={busy}
      >
        <RotateCcw className="h-3 w-3" /> {busy ? "Refunding…" : "Refund"}
      </button>
      {error ? <p className="text-[9.5px] text-rose-600">{error}</p> : null}
      {done ? <p className="text-[9.5px] text-emerald-600">{done}</p> : null}
    </div>
  );
}

export function UserAdminControls({
  userId,
  role,
  status,
  disabled,
}: {
  userId: string;
  role: string;
  status: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [nextRole, setNextRole] = useState(role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function save(patch: { role?: string; status?: string }) {
    setBusy(true);
    setError("");
    setDone("");
    const result = await postJson("/api/admin/users/update", { userId, ...patch });
    if (!result.ok) {
      setError(result.error);
    } else {
      setDone("Saved.");
      router.refresh();
    }
    setBusy(false);
  }

  if (disabled) {
    return <span className="text-[10.5px] text-ink-400">This is your account</span>;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          className="input w-auto px-2 py-1.5 text-[11px]"
          value={nextRole}
          onChange={(event) => setNextRole(event.target.value)}
        >
          {(["attendee", "organizer", "artist", "gate", "admin", "ceo"] as Role[]).map((item) => (
            <option key={item} value={item}>
              {ROLE_LABEL[item]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => save({ role: nextRole })}
          disabled={busy || nextRole === role}
        >
          <Save className="h-3 w-3" /> Role
        </button>
        {status === "active" ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-rose-600"
            onClick={() => save({ status: "suspended" })}
            disabled={busy}
          >
            <Pause className="h-3 w-3" /> Suspend
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-600"
            onClick={() => save({ status: "active" })}
            disabled={busy}
          >
            <Play className="h-3 w-3" /> Reactivate
          </button>
        )}
      </div>
      <Feedback error={error} done={done} />
    </div>
  );
}

export function DeviceAssignForm({
  deviceId,
  gateId,
  staffId,
  gates,
  staff,
}: {
  deviceId: string;
  gateId: string | null;
  staffId: string | null;
  gates: Array<{ id: string; name: string; event_title?: string }>;
  staff: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [gate, setGate] = useState(gateId || "");
  const [member, setMember] = useState(staffId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    setDone("");
    const result = await postJson("/api/admin/operations", {
      action: "assign-device",
      deviceId,
      gateId: gate || null,
      staffId: member || null,
    });
    if (!result.ok) {
      setError(result.error);
    } else {
      setDone("Saved.");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          className="input w-auto max-w-[210px] px-2 py-1.5 text-[11px]"
          value={gate}
          onChange={(e) => setGate(e.target.value)}
        >
          <option value="">Unassigned gate</option>
          {gates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.event_title ? `${item.event_title} · ${item.name}` : item.name}
            </option>
          ))}
        </select>
        <select
          className="input w-auto max-w-[150px] px-2 py-1.5 text-[11px]"
          value={member}
          onChange={(e) => setMember(e.target.value)}
        >
          <option value="">Unassigned staff</option>
          {staff.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-outline btn-sm" onClick={save} disabled={busy}>
          <Save className="h-3 w-3" /> Assign
        </button>
      </div>
      <Feedback error={error} done={done} />
    </div>
  );
}

export function StaffAssignForm({
  events,
  staff,
}: {
  events: Array<{ id: string; title: string }>;
  staff: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [event, setEvent] = useState(events[0]?.id || "");
  const [member, setMember] = useState(staff[0]?.id || "");
  const [gate, setGate] = useState("Main gate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function assign() {
    setBusy(true);
    setError("");
    setDone("");
    const result = await postJson("/api/admin/operations", {
      action: "assign-staff",
      eventId: event,
      userId: member,
      gateName: gate,
    });
    if (!result.ok) {
      setError(result.error);
    } else {
      setDone("Staff member assigned.");
      router.refresh();
    }
    setBusy(false);
  }

  if (!events.length || !staff.length) {
    return (
      <p className="text-[11px] text-ink-400">
        Add gate staff and events before creating assignments.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <select
          className="input text-[12px]"
          value={event}
          onChange={(e) => setEvent(e.target.value)}
        >
          {events.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <select
          className="input text-[12px]"
          value={member}
          onChange={(e) => setMember(e.target.value)}
        >
          {staff.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <input
          className="input text-[12px]"
          value={gate}
          onChange={(e) => setGate(e.target.value)}
          placeholder="Gate name"
        />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={assign} disabled={busy}>
          <Check className="h-3.5 w-3.5" /> Assign to event
        </button>
        <Feedback error={error} done={done} />
      </div>
    </div>
  );
}

export function RemoveStaffButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!window.confirm("Remove this staff assignment?")) return;
    setBusy(true);
    setError("");
    const result = await postJson("/api/admin/operations", {
      action: "remove-staff",
      assignmentId,
    });
    if (!result.ok) setError(result.error);
    else router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={remove}
        className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-rose-600"
        disabled={busy}
      >
        <Trash2 className="h-3 w-3" /> Remove
      </button>
      {error ? <p className="text-[9.5px] text-rose-600">{error}</p> : null}
    </div>
  );
}
