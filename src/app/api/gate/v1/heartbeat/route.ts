import { NextResponse } from "next/server";
import { clientIp, jsonError, readJson } from "@/lib/api";
import { authenticateDeviceRequest, touchDevice } from "@/lib/gates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = authenticateDeviceRequest(request);
  if (!context) {
    return jsonError("Device key is missing, revoked or invalid.", 401);
  }

  const body = await readJson<{ firmware?: string; mode?: string }>(request);
  touchDevice(context.device.id, {
    ip: clientIp(request),
    mode: body?.mode === "offline" ? "offline" : "online",
    firmware: body?.firmware || null,
  });

  return NextResponse.json(
    {
      ok: true,
      serverTime: new Date().toISOString(),
      accepting: context.gate.status === "active",
      device: {
        id: context.device.id,
        name: context.device.name,
        serial: context.device.serial,
        mode: body?.mode === "offline" ? "offline" : "online",
      },
      gate: {
        id: context.gate.id,
        name: context.gate.name,
        kind: context.gate.kind,
        direction: context.gate.direction,
        status: context.gate.status,
        openMs: context.gate.open_ms,
      },
      event: {
        id: context.event.id,
        title: context.event.title,
        startsAt: context.event.starts_at,
        venue: context.event.venue,
        city: context.event.city,
      },
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
      },
    },
  );
}
