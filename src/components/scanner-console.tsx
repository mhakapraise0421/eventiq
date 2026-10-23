"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  CircleAlert,
  ScanLine,
  Search,
  XCircle,
} from "lucide-react";
import { formatTime } from "@/lib/format";

type ScanResult =
  | "accepted"
  | "duplicate"
  | "invalid"
  | "wrong_event"
  | "not_paid"
  | "void"
  | "unauthorised";

interface Outcome {
  result: ScanResult;
  message: string;
  ticket?: {
    code: string;
    holderName: string;
    ticketType: string;
    eventTitle: string;
  };
  scannedAt: string;
}

interface Counts {
  accepted: number;
  duplicate: number;
  rejected: number;
  totalScans: number;
  admitted: number;
  ticketsIssued: number;
}

interface RecentScan {
  id: string;
  ticket_code: string;
  result: string;
  message: string | null;
  gate: string | null;
  scanner_name: string | null;
  created_at: string;
  holder_name: string | null;
  ticket_type_name: string | null;
}

const RESULT_STYLE: Record<
  ScanResult,
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
    label: "Not assigned",
    panel: "border-rose-300 bg-rose-50",
    badge: "bg-rose-600 text-white",
    icon: XCircle,
  },
};

const RESULT_LABEL: Record<string, string> = {
  accepted: "Admitted",
  duplicate: "Duplicate",
  invalid: "Invalid",
  wrong_event: "Wrong event",
  not_paid: "Not paid",
  void: "Voided",
  unauthorised: "Unauthorised",
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
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.35));
  } catch {
    // audio feedback is optional
  }
}

export function ScannerConsole({
  eventId,
  eventTitle,
  gateName,
  canOverride,
}: {
  eventId: string;
  eventTitle: string;
  gateName: string;
  canOverride: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const busyRef = useRef(false);

  const [streaming, setStreaming] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [manual, setManual] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [posting, setPosting] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [showManual, setShowManual] = useState(false);

  const refreshStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/scan/stats?eventId=${eventId}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as { counts: Counts; recent: RecentScan[] };
      setCounts(data.counts);
      setRecent(data.recent);
    } catch {
      // keep previous stats
    }
  }, [eventId]);

  const submit = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value || busyRef.current) return;
      const now = Date.now();
      if (value === lastScanRef.current.code && now - lastScanRef.current.at < 3000) return;
      lastScanRef.current = { code: value, at: now };
      busyRef.current = true;
      setPosting(true);
      try {
        const response = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, raw: value }),
        });
        const data = (await response.json()) as Outcome & { error?: string };
        if (!response.ok) {
          setOutcome({
            result: "invalid",
            message: data.error || "Scan could not be processed.",
            scannedAt: new Date().toISOString(),
          });
          beep(false);
          return;
        }
        setOutcome({ ...data, result: data.result as ScanResult });
        beep(data.result === "accepted");
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(data.result === "accepted" ? 40 : [60, 60, 60]);
        }
        setManual("");
        await refreshStats();
      } catch {
        setOutcome({
          result: "invalid",
          message: "Network error — ticket not validated. Do not admit until retried.",
          scannedAt: new Date().toISOString(),
        });
        beep(false);
      } finally {
        busyRef.current = false;
        setPosting(false);
      }
    },
    [eventId, refreshStats],
  );

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);
    const image = context.getImageData(0, 0, width, height);
    const found = jsQR(image.data, image.width, image.height, {
      inversionAttempts: "dontInvert",
    });
    if (found?.data) {
      void submit(found.data);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [submit]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStreaming(true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCameraError(
        "Camera unavailable. Check browser permissions, or enter the ticket code manually.",
      );
      setShowManual(true);
    }
  }, [tick]);

  const stopCamera = useCallback(() => {
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (video) video.srcObject = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setStreaming(false);
  }, []);

  useEffect(() => {
    void refreshStats();
    const interval = window.setInterval(refreshStats, 8000);
    return () => {
      window.clearInterval(interval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [refreshStats]);

  const style = outcome ? RESULT_STYLE[outcome.result] : null;
  const ResultIcon = style?.icon;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">Admitted</p>
          <p className="mt-0.5 font-display text-[22px] font-semibold text-ink-950">
            {counts?.admitted ?? "—"}
            <span className="ml-1 text-[12px] font-normal text-ink-400">
              / {counts?.ticketsIssued ?? "—"}
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-line bg-white px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
            Duplicates blocked
          </p>
          <p className="mt-0.5 font-display text-[22px] font-semibold text-amber-600">
            {counts?.duplicate ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-white px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
            Rejected
          </p>
          <p className="mt-0.5 font-display text-[22px] font-semibold text-rose-600">
            {counts?.rejected ?? "—"}
          </p>
        </div>
      </div>

      {style && outcome && ResultIcon ? (
        <div className={`rounded-2xl border-2 px-4 py-4 ${style.panel}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <ResultIcon className="mt-0.5 h-7 w-7 shrink-0" />
              <div>
                <p className="font-display text-[20px] font-semibold tracking-[-0.02em] text-ink-950">
                  {style.label}
                </p>
                <p className="mt-0.5 text-[12px] text-ink-600">{outcome.message}</p>
                {outcome.ticket ? (
                  <div className="mt-2 space-y-0.5 text-[11.5px] text-ink-700">
                    <p>
                      <strong className="font-semibold">{outcome.ticket.holderName}</strong> ·{" "}
                      {outcome.ticket.ticketType}
                    </p>
                    <p className="font-mono text-[10.5px] text-ink-500">{outcome.ticket.code}</p>
                  </div>
                ) : null}
              </div>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}
            >
              {RESULT_LABEL[outcome.result] || outcome.result}
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-surface/60 px-4 py-6 text-center">
          <ScanLine className="mx-auto h-6 w-6 text-ink-300" />
          <p className="mt-2 text-[12.5px] font-semibold text-ink-700">Ready to scan</p>
          <p className="mt-0.5 text-[11px] text-ink-400">
            Point the camera at the QR code, or enter a ticket code manually.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-semibold text-ink-900">
            Camera · <span className="font-normal text-ink-400">{gateName}</span>
          </p>
          {streaming ? (
            <button type="button" className="btn btn-ghost btn-sm text-rose-600" onClick={stopCamera}>
              <CameraOff className="h-3.5 w-3.5" /> Stop
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={startCamera}>
              <Camera className="h-3.5 w-3.5" /> Start camera
            </button>
          )}
        </div>
        <div className="relative mt-3 overflow-hidden rounded-xl bg-ink-950">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`aspect-[4/3] w-full object-cover ${streaming ? "" : "opacity-0"}`}
          />
          {streaming ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-44 w-44 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(9,9,11,0.35)]" />
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <Camera className="h-7 w-7 text-white/50" />
              <p className="mt-2 text-[11.5px] text-white/60">
                Camera preview appears here when started.
              </p>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
        {cameraError ? (
          <p className="mt-2 text-[11px] text-amber-600">{cameraError}</p>
        ) : null}
        {!streaming ? (
          <p className="mt-2 text-[10.5px] text-ink-400">
            Scanning requires HTTPS (or localhost) and camera permission.{" "}
            {canOverride
              ? "Oversight accounts can scan any event."
              : "You can only validate tickets for events you are assigned to."}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-line bg-white p-3">
        <button
          type="button"
          onClick={() => setShowManual((value) => !value)}
          className="flex w-full items-center justify-between text-[12px] font-semibold text-ink-900"
        >
          <span className="inline-flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5" /> Manual code entry
          </span>
          <span className="text-[10.5px] font-normal text-ink-400">
            {showManual ? "Hide" : "Show"}
          </span>
        </button>
        {showManual ? (
          <form
            className="mt-2 flex gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              void submit(manual);
            }}
          >
            <input
              className="input flex-1 font-mono text-[12px] uppercase"
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              placeholder="EVQ-XXXX-XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={posting}>
              {posting ? "Checking…" : "Validate"}
            </button>
          </form>
        ) : null}
      </div>

      <div className="rounded-2xl border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
          <p className="text-[12px] font-semibold text-ink-900">Recent scans</p>
          <span className="text-[10px] text-ink-400">{counts?.totalScans ?? 0} total</span>
        </div>
        {recent.length ? (
          <ul className="divide-y divide-line">
            {recent.slice(0, 8).map((scan) => (
              <li key={scan.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-ink-800">
                    {scan.holder_name || scan.ticket_code}
                  </p>
                  <p className="truncate text-[10px] text-ink-400">
                    {scan.ticket_code} · {scan.gate || "—"} · {formatTime(scan.created_at)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${
                    scan.result === "accepted"
                      ? "bg-emerald-50 text-emerald-700"
                      : scan.result === "duplicate"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {RESULT_LABEL[scan.result] || scan.result}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-5 text-center text-[11px] text-ink-400">
            No scans yet for {eventTitle}.
          </p>
        )}
      </div>
    </div>
  );
}
