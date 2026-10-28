import { NextResponse } from "next/server";
import { clientIp, jsonError, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import {
  getScanByClientId,
  recordInvalidDeviceScan,
  validateScan,
} from "@/lib/gate";
import { authenticateDeviceRequest, touchDevice } from "@/lib/gates";
import { parseScannedPayload } from "@/lib/ticket-code";
import type { ScanResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ScanAction = "open" | "deny" | "none";

interface ScanInput {
  scanId?: string;
  raw?: string;
  mode?: string;
}

interface ScanResultItem {
  scanId: string;
  result: ScanResult;
  message: string;
  action: ScanAction;
  replay?: boolean;
  ticket?: {
    code: string;
    holderName: string;
    ticketType: string;
    eventTitle: string;
  };
  scannedAt: string;
}

export async function POST(request: Request) {
  const context = authenticateDeviceRequest(request);
  if (!context) {
    return jsonError("Device key is missing, revoked or invalid.", 401);
  }
  if (context.gate.status !== "active") {
    return jsonError(
      `This gate is ${context.gate.status}. Scans are paused until an administrator reopens it.`,
      409,
    );
  }

  const limited = rateLimit(`gate-scan:${context.device.id}`, 600, 60_000);
  if (!limited.ok) {
    return jsonError("Too many scans from this device. Slow down and retry.", 429);
  }

  const body = await readJson<{ scans?: ScanInput[] }>(request);
  if (!Array.isArray(body?.scans) || body.scans.length === 0) {
    return jsonError("Send at least one scan.");
  }
  if (body.scans.length > 50) {
    return jsonError("Send at most 50 scans per batch.");
  }

  const ip = clientIp(request);
  const actor = {
    id: context.device.id,
    name: context.device.name,
    role: "gate",
    gate: context.gate.name,
    deviceId: context.device.id,
  };

  const results: ScanResultItem[] = [];

  for (const scan of body.scans) {
    const scanId = typeof scan.scanId === "string" ? scan.scanId.trim() : "";
    if (scanId.length < 8 || scanId.length > 100) {
      results.push({
        scanId,
        result: "invalid",
        message: "Each scan needs a scanId between 8 and 100 characters.",
        action: "deny",
        scannedAt: new Date().toISOString(),
      });
      continue;
    }

    const existing = getScanByClientId(context.device.id, scanId);
    if (existing) {
      results.push({
        scanId,
        result: existing.result,
        message: existing.message || "Replay of an earlier scan.",
        action: "none",
        replay: true,
        scannedAt: existing.created_at,
      });
      continue;
    }

    const raw = typeof scan.raw === "string" ? scan.raw.trim() : "";
    const mode = scan.mode === "offline" ? "offline" : "online";
    const code = raw ? parseScannedPayload(raw, { requireSignature: true }) : null;

    if (!code) {
      try {
        recordInvalidDeviceScan({
          raw,
          eventId: context.gate.event_id,
          gate: context.gate.name,
          gateId: context.gate.id,
          actor,
          clientScanId: scanId,
          mode,
        });
      } catch (error) {
        const replay = getScanByClientId(context.device.id, scanId);
        if (replay) {
          results.push({
            scanId,
            result: replay.result,
            message: replay.message || "Replay of an earlier scan.",
            action: "none",
            replay: true,
            scannedAt: replay.created_at,
          });
          continue;
        }
        console.error("Could not record rejected gate scan", error);
        return jsonError("Could not record the scan. Please retry.", 500);
      }
      results.push({
        scanId,
        result: "invalid",
        message: "Unrecognised or unsigned ticket payload. Do not admit.",
        action: "deny",
        scannedAt: new Date().toISOString(),
      });
      continue;
    }

    try {
      const outcome = validateScan({
        code,
        eventId: context.gate.event_id,
        actor,
        bypassAssignment: true,
        gateId: context.gate.id,
        clientScanId: scanId,
        source: "device",
        mode,
      });
      results.push({
        scanId,
        result: outcome.result,
        message: outcome.message,
        action: outcome.result === "accepted" ? "open" : "deny",
        ticket: outcome.ticket,
        scannedAt: outcome.scannedAt,
      });
    } catch (error) {
      const replay = getScanByClientId(context.device.id, scanId);
      if (replay) {
        results.push({
          scanId,
          result: replay.result,
          message: replay.message || "Replay of an earlier scan.",
          action: "none",
          replay: true,
          scannedAt: replay.created_at,
        });
        continue;
      }
      console.error("Gate scan failed", error);
      return jsonError("Could not validate the scan. Do not admit until retried.", 500);
    }
  }

  touchDevice(context.device.id, { ip, mode: "online" });

  return NextResponse.json(
    {
      ok: true,
      serverTime: new Date().toISOString(),
      device: { id: context.device.id, name: context.device.name },
      gate: {
        id: context.gate.id,
        name: context.gate.name,
        kind: context.gate.kind,
        status: context.gate.status,
        openMs: context.gate.open_ms,
      },
      results,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
      },
    },
  );
}
