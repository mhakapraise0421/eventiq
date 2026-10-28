"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { formatDateTime, formatTime } from "@/lib/format";

const STORAGE_KEY = "eventiq.virtualGate";

interface GateSession {
  token: string;
  pairedAt: string;
  device: { id: string; name: string; serial: string };
  gate: {
    id: string;
    name: string;
    kind: string;
    direction: string;
    status: string;
    openMs: number;
  };
  event: {
    id: string;
    title: string;
    startsAt: string;
    venue: string;
    city: string;
  };
}

interface ScanTicket {
  code: string;
  holderName: string;
  ticketType: string;
  eventTitle: string;
}

interface ScanResponse {
  scanId: string;
  result:
    | "accepted"
    | "duplicate"
    | "invalid"
    | "wrong_event"
    | "not_paid"
    | "void"
    | "unauthorised";
  message: string;
  action: "open" | "deny" | "none";
  replay?: boolean;
  ticket?: ScanTicket;
  scannedAt: string;
}

interface RecentScan extends ScanResponse {
  at: number;
}

const RESULT_STYLE: Record<
  ScanResponse["result"],
  { label: string; panel: string; badge: string; icon: typeof CheckCircle2 }
> = {
  accepted: {
    label: "Admit",
    panel: "border-emerald-300 bg-emerald-50",
    badge: "bg-emerald-600 text-white",
    icon: CheckCircle2,
  },
  duplicate: {
    label: "Duplicate",
    panel: "border-amber-300 bg-amber-50",
    badge: "bg-amber-500 text-white",
    icon: CircleAlert,
  },
  invalid: {
    label: "Invalid",
    panel: "border-rose-300 bg-rose-50",
    badge: "bg-rose-600 text-white",
    icon: XCircle,
  },
  wrong_event: {
    label: "Wrong event",
    panel: "border-rose-300 bg-rose-50",
    badge: "bg-rose-600 text-white",
    icon: XCircle,
  },
  not_paid: {
    label: "Not paid",
    panel: "border-rose-300 bg-rose-50",
    badge: "bg-rose-600 text-white",
    icon: XCircle,
  },
  void: {
    label: "Voided",
    panel: "border-rose-300 bg-rose-50",
    badge: "bg-rose-600 text-white",
    icon: XCircle,
  },
  unauthorised: {
    label: "Not allowed",
    panel: "border-rose-300 bg-rose-50",
    badge: "bg-rose-600 text-white",
    icon: XCircle,
  },
};

function beep(ok: boolean) {
  try {
    const Ctx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.07;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.3));
  } catch {
    // audio feedback is optional
  }
}

function readSession(): GateSession | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GateSession;
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

export function VirtualGate() {
  const [session, setSession] = useState<GateSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [code, setCode] = useState("");
  const [serial, setSerial] = useState("");
  const [pairing, setPairing] = useState(false);
  const [pairError, setPairError] = useState("");
  const [health, setHealth] = useState<{
    state: "connecting" | "online" | "offline" | "revoked";
    accepting?: boolean;
    at?: string;
    message?: string;
  }>({ state: "connecting" });
  const [scanValue, setScanValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [outcome, setOutcome] = useState<ScanResponse | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const openTimer = useRef<number | null>(null);

  useEffect(() => {
    setSession(readSession());
    setLoaded(true);
    return () => {
      if (openTimer.current) window.clearTimeout(openTimer.current);
    };
  }, []);

  const ping = useCallback(async () => {
    if (!session) return;
    try {
      const response = await fetch("/api/gate/v1/heartbeat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "online", firmware: "virtual-gate-1.0" }),
      });
      if (response.status === 401) {
        setHealth({ state: "revoked", message: "This device key was revoked. Pair again." });
        return;
      }
      const data = (await response.json()) as {
        accepting?: boolean;
        error?: string;
        serverTime?: string;
      };
      if (!response.ok) {
        setHealth({
          state: "offline",
          message: data.error || "Heartbeat failed.",
        });
        return;
      }
      setHealth({
        state: "online",
        accepting: data.accepting,
        at: data.serverTime || new Date().toISOString(),
      });
    } catch {
      setHealth({
        state: "offline",
        message: "No response from EventIQ. A real bridge would keep its cached manifest here.",
      });
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setHealth({ state: "connecting" });
      return;
    }
    void ping();
    const interval = window.setInterval(ping, 15_000);
    return () => window.clearInterval(interval);
  }, [session, ping]);

  async function pair() {
    setPairing(true);
    setPairError("");
    try {
      const response = await fetch("/api/gate/v1/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, serial }),
      });
      const data = (await response.json()) as GateSession & { error?: string };
      if (!response.ok || !data.token) {
        setPairError(data.error || "Could not pair this virtual gate.");
        return;
      }
      const next: GateSession = {
        token: data.token,
        pairedAt: new Date().toISOString(),
        device: data.device,
        gate: data.gate,
        event: data.event,
      };
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSession(next);
      setCode("");
      setSerial("");
      setOutcome(null);
      setRecent([]);
      setHealth({ state: "online", accepting: next.gate.status === "active" });
    } catch {
      setPairError("Network error while pairing. Check the code and try again.");
    } finally {
      setPairing(false);
    }
  }

  function forget() {
    window.sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setHealth({ state: "connecting" });
    setOutcome(null);
    setRecent([]);
    setGateOpen(false);
  }

  function triggerOpen(openMs: number) {
    setGateOpen(true);
    beep(true);
    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(
      () => setGateOpen(false),
      Math.max(900, Math.min(2500, openMs || 600)),
    );
  }

  async function submitScan(event: FormEvent) {
    event.preventDefault();
    if (!session || scanning) return;
    const raw = scanValue.trim();
    if (!raw) return;
    setScanning(true);
    setOutcome(null);
    try {
      const response = await fetch("/api/gate/v1/scans", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scans: [{ scanId: crypto.randomUUID(), raw, mode: "online" }],
        }),
      });
      if (response.status === 401) {
        setHealth({ state: "revoked", message: "This device key was revoked. Pair again." });
        return;
      }
      const data = (await response.json()) as {
        error?: string;
        results?: ScanResponse[];
      };
      if (!response.ok) {
        setOutcome({
          scanId: "",
          result: "invalid",
          message: data.error || "The gate API rejected the request.",
          action: "deny",
          scannedAt: new Date().toISOString(),
        });
        beep(false);
        return;
      }
      const result = data.results?.[0];
      if (!result) {
        setOutcome({
          scanId: "",
          result: "invalid",
          message: "No scan result returned.",
          action: "deny",
          scannedAt: new Date().toISOString(),
        });
        beep(false);
        return;
      }
      setOutcome(result);
      setRecent((items) => [{ ...result, at: Date.now() }, ...items].slice(0, 6));
      setScanValue("");
      if (result.action === "open") {
        triggerOpen(session.gate.openMs);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(50);
        }
      } else {
        beep(false);
      }
    } catch {
      setOutcome({
        scanId: "",
        result: "invalid",
        message: "Network error — the gate did not receive a decision. Do not admit.",
        action: "deny",
        scannedAt: new Date().toISOString(),
      });
      beep(false);
    } finally {
      setScanning(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-[12px] text-ink-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading simulator…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div>
          <p className="text-[11.5px] font-semibold text-amber-900">
            Simulation only — no physical gate is connected
          </p>
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-amber-800">
            This page uses the same authenticated device API a venue bridge will use. The
            turnstile or barrier movement here is a virtual relay, not hardware control.
          </p>
        </div>
      </div>

      {!session ? (
        <section className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-brand-600" />
            <h2 className="font-display text-[16px] font-semibold text-ink-950">
              Pair this browser as a virtual controller
            </h2>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
            In Operations, add a gate and a device, then press <strong>Pair</strong> to get a
            one-time code. Enter that code and the device serial here.
          </p>
          <form
            className="mt-3 grid gap-2 sm:grid-cols-[1.2fr_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              void pair();
            }}
          >
            <input
              className="input font-mono text-[12px] uppercase tracking-[0.04em]"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="PAIR-XXXX-XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
            />
            <input
              className="input font-mono text-[12px] uppercase"
              value={serial}
              onChange={(event) => setSerial(event.target.value)}
              placeholder="Device serial"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={pairing || !code.trim() || !serial.trim()}
            >
              {pairing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
              {pairing ? "Pairing…" : "Pair gate"}
            </button>
          </form>
          {pairError ? <p className="mt-1.5 text-[10.5px] text-rose-600">{pairError}</p> : null}
          <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
            The key is held in this browser&apos;s session storage for the simulation. A real
            bridge stores it in protected local storage. Pairing again replaces the device&apos;s
            existing key.
          </p>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                {session.event.title}
              </p>
              <h2 className="mt-0.5 font-display text-[18px] font-semibold tracking-[-0.02em] text-ink-950">
                {session.gate.name}
              </h2>
              <p className="mt-0.5 text-[10.5px] text-ink-500">
                {session.device.name} · {session.device.serial}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  health.state === "online"
                    ? "bg-emerald-50 text-emerald-700"
                    : health.state === "revoked"
                      ? "bg-rose-50 text-rose-700"
                      : "bg-amber-50 text-amber-700"
                }`}
              >
                {health.state === "online" ? (
                  <Wifi className="h-3 w-3" />
                ) : (
                  <WifiOff className="h-3 w-3" />
                )}
                {health.state === "online"
                  ? health.accepting
                    ? "Online · accepting"
                    : "Online · gate paused"
                  : health.state === "revoked"
                    ? "Key revoked"
                    : "Reconnecting…"}
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void ping()}>
                <RefreshCw className="h-3 w-3" /> Ping
              </button>
              <button type="button" className="btn btn-ghost btn-sm text-ink-500" onClick={forget}>
                <LogOut className="h-3 w-3" /> Forget
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
            <div className="space-y-3">
              <GateVisual
                kind={session.gate.kind}
                open={gateOpen}
                openMs={session.gate.openMs}
                gateName={session.gate.name}
                accepting={health.accepting !== false}
              />

              <form onSubmit={submitScan} className="rounded-2xl border border-line bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold text-ink-900">Feed a scanned payload</p>
                  <span className="text-[9.5px] text-ink-400">Signed QR only</span>
                </div>
                <div className="mt-2 flex flex-col gap-1.5 sm:flex-row">
                  <input
                    className="input flex-1 font-mono text-[11px]"
                    value={scanValue}
                    onChange={(event) => setScanValue(event.target.value)}
                    placeholder="EVQ1|EVQ-XXXX-XXXX-XXXX|…"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={scanning || !scanValue.trim()}
                  >
                    {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {scanning ? "Checking…" : "Scan at gate"}
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-ink-400">
                  Paste the payload from a ticket QR, or send it from a handheld scanner. Raw
                  human-readable codes are deliberately rejected by the device API.
                </p>
              </form>

              {outcome ? <OutcomePanel outcome={outcome} /> : null}
            </div>

            <div className="space-y-3">
              <section className="rounded-2xl border border-line bg-white p-3">
                <p className="text-[12px] font-semibold text-ink-900">Session</p>
                <dl className="mt-2 space-y-1.5 text-[10.5px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-400">Event</dt>
                    <dd className="text-right font-semibold text-ink-800">
                      {session.event.title}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-400">Venue</dt>
                    <dd className="text-right text-ink-700">
                      {session.event.venue}, {session.event.city}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-400">Gate kind</dt>
                    <dd className="text-right capitalize text-ink-700">
                      {session.gate.kind} · {session.gate.direction}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-400">Open pulse</dt>
                    <dd className="text-right font-mono text-ink-700">
                      {session.gate.openMs} ms
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-400">Last heartbeat</dt>
                    <dd className="text-right text-ink-700">
                      {health.at ? formatDateTime(health.at) : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-400">Paired</dt>
                    <dd className="text-right text-ink-700">
                      {formatDateTime(session.pairedAt)}
                    </dd>
                  </div>
                </dl>
                {health.message ? (
                  <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1.5 text-[10px] text-rose-700">
                    {health.message}
                  </p>
                ) : null}
              </section>

              <section className="rounded-2xl border border-line bg-white">
                <header className="flex items-center justify-between border-b border-line px-3 py-2">
                  <p className="text-[12px] font-semibold text-ink-900">Simulator scans</p>
                  <span className="text-[9.5px] text-ink-400">{recent.length} shown</span>
                </header>
                {recent.length ? (
                  <ul className="divide-y divide-line">
                    {recent.map((item) => (
                      <li
                        key={`${item.scanId}-${item.at}`}
                        className="flex items-start justify-between gap-2 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[10.5px] font-semibold text-ink-800">
                            {item.ticket?.holderName || item.ticket?.code || "Scan"}
                          </p>
                          <p className="truncate text-[9.5px] text-ink-400">
                            {item.replay
                              ? "Replay · no second open"
                              : item.action === "open"
                                ? `Relay open · ${formatTime(new Date(item.at).toISOString())}`
                                : `Denied · ${formatTime(new Date(item.at).toISOString())}`}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                            item.result === "accepted"
                              ? "bg-emerald-50 text-emerald-700"
                              : item.result === "duplicate"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {RESULT_STYLE[item.result]?.label || item.result}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 py-5 text-center text-[10.5px] text-ink-400">
                    No scans in this session yet.
                  </p>
                )}
              </section>

              <Link
                href="/admin/operations"
                className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-ink-500 hover:text-ink-900"
              >
                <ArrowLeft className="h-3 w-3" /> Back to operations
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function GateVisual({
  kind,
  open,
  openMs,
  gateName,
  accepting,
}: {
  kind: string;
  open: boolean;
  openMs: number;
  gateName: string;
  accepting: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-800 bg-gradient-to-br from-ink-950 via-ink-900 to-brand-900 p-4 text-white">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Virtual {kind === "overhead" ? "overhead gate" : kind === "turnstile" ? "turnstile" : "handheld lane"}
          </p>
          <p className="mt-0.5 font-display text-[15px] font-semibold">{gateName}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[9.5px] font-bold tracking-[0.08em] ${
            open
              ? "bg-emerald-400 text-ink-950"
              : accepting
                ? "bg-white/10 text-white/65"
                : "bg-rose-500/20 text-rose-200"
          }`}
        >
          {open ? "OPEN" : accepting ? "CLOSED" : "PAUSED"}
        </span>
      </div>

      <div className="relative mt-4 flex h-44 items-center justify-center sm:h-48">
        {kind === "turnstile" ? (
          <>
            <span className="absolute bottom-2 left-5 h-32 w-5 rounded-t-md bg-white/15 sm:left-10" />
            <span className="absolute bottom-2 right-5 h-32 w-5 rounded-t-md bg-white/15 sm:right-10" />
            <div
              className={`relative h-24 w-24 rounded-full border border-white/15 bg-white/5 transition-transform duration-700 ease-out ${
                open ? "rotate-[120deg]" : "rotate-0"
              }`}
            >
              {[0, 120, 240].map((degrees) => (
                <span
                  key={degrees}
                  className="absolute left-1/2 top-1/2 h-3 w-24 origin-left rounded-full bg-gradient-to-r from-aqua-400 to-brand-400 shadow-[0_0_16px_rgba(34,211,238,0.25)]"
                  style={{ transform: `rotate(${degrees}deg) translateY(-50%)` }}
                />
              ))}
              <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
            </div>
            <span className="absolute bottom-2 h-2 w-40 rounded-full bg-white/10" />
          </>
        ) : kind === "overhead" ? (
          <>
            <span className="absolute bottom-2 left-8 h-32 w-5 rounded-t-md bg-white/15 sm:left-14" />
            <span className="absolute bottom-2 right-8 h-32 w-5 rounded-t-md bg-white/15 sm:right-14" />
            <div
              className={`absolute bottom-[118px] left-[52px] h-3 w-[62%] origin-left rounded-full bg-gradient-to-r from-white via-aqua-300 to-aqua-400 transition-transform duration-700 ease-out sm:left-[76px] ${
                open ? "-rotate-[72deg]" : "rotate-0"
              }`}
            />
            <span className="absolute bottom-2 h-1.5 w-36 rounded-full bg-white/10" />
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-28 w-20 items-center justify-center rounded-2xl border border-white/20 bg-white/5">
              <div className="h-16 w-12 rounded-lg border-2 border-aqua-400/70" />
            </div>
            <p className="text-[9.5px] text-white/45">Handheld scanner</p>
          </div>
        )}

        <span
          className={`absolute bottom-3 right-3 rounded-full px-2 py-0.5 text-[8.5px] font-semibold ${
            open ? "bg-emerald-400/20 text-emerald-200" : "bg-white/10 text-white/45"
          }`}
        >
          {open ? `Relay pulse ${openMs}ms` : "Relay idle"}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-[9px] text-white/35">
        <span className="inline-flex items-center gap-1">
          <LockKeyhole className="h-3 w-3" /> Software relay simulation
        </span>
        <span>No physical hardware connected</span>
      </div>
    </div>
  );
}

function OutcomePanel({ outcome }: { outcome: ScanResponse }) {
  const style = RESULT_STYLE[outcome.result] || RESULT_STYLE.invalid;
  const Icon = style.icon;
  return (
    <div className={`rounded-2xl border-2 px-4 py-3 ${style.panel}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Icon className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-display text-[15px] font-semibold text-ink-950">
              {style.label}
              {outcome.action === "open"
                ? " — relay opened"
                : outcome.replay
                  ? " — replay, no open"
                  : ""}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-600">{outcome.message}</p>
            {outcome.ticket ? (
              <p className="mt-1 text-[10.5px] text-ink-700">
                <strong>{outcome.ticket.holderName}</strong> · {outcome.ticket.ticketType} ·{" "}
                <span className="font-mono text-[9.5px]">{outcome.ticket.code}</span>
              </p>
            ) : null}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${style.badge}`}>
          {style.label}
        </span>
      </div>
    </div>
  );
}
