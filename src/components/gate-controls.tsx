"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Plus, ShieldAlert, ShieldCheck } from "lucide-react";
import { formatDateTime } from "@/lib/format";

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

export function GateCreateForm({ events }: { events: Array<{ id: string; title: string }> }) {
  const router = useRouter();
  const [eventId, setEventId] = useState(events[0]?.id || "");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("turnstile");
  const [direction, setDirection] = useState("in");
  const [openMs, setOpenMs] = useState("600");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function create() {
    setBusy(true);
    setError("");
    setDone("");
    const result = await postJson("/api/admin/operations", {
      action: "create-gate",
      eventId,
      name,
      kind,
      direction,
      openMs: Number(openMs),
    });
    if (!result.ok) {
      setError(result.error);
    } else {
      setName("");
      setDone("Gate created. Add a device to it, then pair the device.");
      router.refresh();
    }
    setBusy(false);
  }

  if (!events.length) {
    return <p className="text-[11px] text-ink-400">Create an event before adding gates.</p>;
  }

  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-3">
      <p className="text-[11px] font-semibold text-ink-800">Add a gate</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_0.7fr_auto]">
        <input
          className="input text-[12px]"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Gate or lane name"
          maxLength={60}
        />
        <select
          className="input text-[12px]"
          value={eventId}
          onChange={(event) => setEventId(event.target.value)}
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
        <select
          className="input text-[12px]"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          aria-label="Gate hardware type"
        >
          <option value="turnstile">Turnstile</option>
          <option value="overhead">Overhead gate</option>
          <option value="handheld">Handheld lane</option>
        </select>
        <select
          className="input text-[12px]"
          value={direction}
          onChange={(event) => setDirection(event.target.value)}
          aria-label="Gate direction"
        >
          <option value="in">Entry</option>
          <option value="out">Exit</option>
          <option value="both">Entry and exit</option>
        </select>
        <input
          className="input text-[12px]"
          type="number"
          min={200}
          max={5000}
          step={100}
          value={openMs}
          onChange={(event) => setOpenMs(event.target.value)}
          title="Relay pulse in milliseconds"
          aria-label="Open pulse in milliseconds"
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={create}
          disabled={busy || !name.trim()}
        >
          <Plus className="h-3.5 w-3.5" /> {busy ? "Adding…" : "Add gate"}
        </button>
      </div>
      <p className="mt-1.5 text-[10px] text-ink-400">
        The pulse is how long the bridge holds the open signal for a turnstile or overhead gate.
      </p>
      <Feedback error={error} done={done} />
    </div>
  );
}

export function GateStatusControl({ gateId, status }: { gateId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function change(next: string) {
    if (next === status) return;
    setBusy(true);
    setError("");
    const result = await postJson("/api/admin/operations", {
      action: "set-gate-status",
      gateId,
      status: next,
    });
    if (!result.ok) setError(result.error);
    else router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(["active", "maintenance", "closed"] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => change(item)}
          disabled={busy || status === item}
          className={`rounded-full border px-2 py-0.5 text-[9.5px] font-semibold transition ${
            status === item
              ? "border-ink-900 bg-ink-900 text-white"
              : "border-line bg-white text-ink-500 hover:border-ink-300"
          }`}
        >
          {item === "active" ? "Open" : item === "maintenance" ? "Pause" : "Close"}
        </button>
      ))}
      {error ? <span className="text-[9.5px] text-rose-600">{error}</span> : null}
    </div>
  );
}

export function DeviceCreateForm({
  gates,
}: {
  gates: Array<{ id: string; name: string; event_title?: string }>;
}) {
  const router = useRouter();
  const [gateId, setGateId] = useState(gates[0]?.id || "");
  const [name, setName] = useState("");
  const [serial, setSerial] = useState("");
  const [type, setType] = useState("gate_controller");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    if (!gates.some((gate) => gate.id === gateId)) {
      setGateId(gates[0]?.id || "");
    }
  }, [gates, gateId]);

  async function create() {
    if (!gateId) {
      setError("Choose a gate for this device.");
      return;
    }
    setBusy(true);
    setError("");
    setDone("");
    const result = await postJson("/api/admin/operations", {
      action: "create-device",
      gateId,
      name,
      serial,
      type,
    });
    if (!result.ok) {
      setError(result.error);
    } else {
      setName("");
      setSerial("");
      setDone("Device registered. Use Pair to get its one-time key.");
      router.refresh();
    }
    setBusy(false);
  }

  if (!gates.length) {
    return <p className="text-[11px] text-ink-400">Add a gate before registering a device.</p>;
  }

  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-3">
      <p className="text-[11px] font-semibold text-ink-800">Register a device</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_auto]">
        <input
          className="input text-[12px]"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Device name"
          maxLength={80}
        />
        <input
          className="input text-[12px] font-mono uppercase"
          value={serial}
          onChange={(event) => setSerial(event.target.value)}
          placeholder="Serial number"
          maxLength={64}
        />
        <select
          className="input text-[12px]"
          value={type}
          onChange={(event) => setType(event.target.value)}
          aria-label="Device type"
        >
          <option value="gate_controller">Gate controller</option>
          <option value="scanner">Scanner</option>
          <option value="bridge">Gate bridge</option>
        </select>
        <select
          className="input text-[12px]"
          value={gateId}
          onChange={(event) => setGateId(event.target.value)}
          aria-label="Gate"
        >
          {gates.map((gate) => (
            <option key={gate.id} value={gate.id}>
              {gate.event_title ? `${gate.event_title} · ${gate.name}` : gate.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={create}
          disabled={busy || !name.trim() || !serial.trim()}
        >
          <Plus className="h-3.5 w-3.5" /> {busy ? "Adding…" : "Register"}
        </button>
      </div>
      <Feedback error={error} done={done} />
    </div>
  );
}

export function DevicePairButton({
  deviceId,
  paired,
  prefix,
}: {
  deviceId: string;
  paired: boolean;
  prefix: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pairing, setPairing] = useState<{
    code: string;
    expiresAt: string;
    serial: string;
    deviceName: string;
    gateName: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (paired && !window.confirm("Pairing again replaces the device's current key. Continue?")) {
      return;
    }
    setBusy(true);
    setError("");
    setCopied(false);
    const result = await fetch("/api/admin/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pair-device", deviceId }),
    });
    const data = (await result.json()) as {
      error?: string;
      pairing?: {
        code: string;
        expiresAt: string;
        serial: string;
        deviceName: string;
        gateName: string | null;
      };
    };
    if (!result.ok) {
      setError(data.error || "Could not create a pairing code.");
    } else if (data.pairing) {
      setPairing(data.pairing);
    }
    setBusy(false);
  }

  async function copy() {
    if (!pairing) return;
    try {
      await navigator.clipboard.writeText(pairing.code);
      setCopied(true);
    } catch {
      setError("Copy failed — select the code manually.");
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-brand-700"
        onClick={generate}
        disabled={busy}
      >
        <KeyRound className="h-3 w-3" />
        {busy ? "Creating…" : paired ? "Repair" : "Pair"}
      </button>
      {paired && prefix ? (
        <span className="font-mono text-[9px] text-ink-400">{prefix}…</span>
      ) : (
        <span className="text-[9px] text-ink-400">Not paired</span>
      )}
      {error ? <span className="text-[9.5px] text-rose-600">{error}</span> : null}
      {pairing ? (
        <div className="mt-1 w-full min-w-[260px] rounded-xl border border-brand-200 bg-brand-50/60 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-brand-700">
            One-time pairing code
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="font-mono text-[15px] font-bold tracking-[0.08em] text-ink-950">
              {pairing.code}
            </p>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-brand-700"
            >
              <Copy className="h-3 w-3" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-1 text-[9.5px] leading-relaxed text-ink-500">
            Serial <span className="font-mono text-ink-800">{pairing.serial}</span> · expires{" "}
            {formatDateTime(pairing.expiresAt)}. Use it once on the bridge or the{" "}
            <Link href="/admin/operations/simulator" className="font-semibold text-brand-700">
              virtual gate simulator
            </Link>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function RevokeDeviceButton({ deviceId, paired }: { deviceId: string; paired: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!paired) return null;

  async function revoke() {
    if (!window.confirm("Revoke this device key? Any bridge using it will be locked out.")) {
      return;
    }
    setBusy(true);
    setError("");
    const result = await postJson("/api/admin/operations", {
      action: "revoke-device",
      deviceId,
    });
    if (!result.ok) setError(result.error);
    else router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={revoke}
        disabled={busy}
        className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600"
      >
        <ShieldAlert className="h-3 w-3" /> {busy ? "Revoking…" : "Revoke key"}
      </button>
      {error ? <span className="text-[9.5px] text-rose-600">{error}</span> : null}
    </div>
  );
}

export function PairingSafetyNote() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-line bg-white px-3 py-2.5">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
      <p className="text-[10.5px] leading-relaxed text-ink-500">
        A device key is scoped to one event and gate. Pairing codes expire after 10 minutes and can
        be used once. Revoking a key immediately stops that bridge from scanning. The virtual gate
        is clearly simulated — no physical hardware is connected.
      </p>
    </div>
  );
}

