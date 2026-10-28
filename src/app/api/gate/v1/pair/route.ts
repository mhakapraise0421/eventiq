import { NextResponse } from "next/server";
import { clientIp, jsonError, readJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { pairDevice } from "@/lib/gates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`gate-pair:${ip}`, 10, 60_000);
  if (!limited.ok) {
    return jsonError("Too many pairing attempts. Try again in a minute.", 429);
  }

  const body = await readJson<{ code?: string; serial?: string }>(request);
  if (!body?.code || !body.serial) {
    return jsonError("Enter the one-time pairing code and the device serial number.");
  }

  const result = pairDevice(
    { code: body.code, serial: body.serial },
    ip,
  );
  if (!result.ok) return jsonError(result.error, 400);

  return NextResponse.json(
    {
      ok: true,
      token: result.token,
      device: result.device,
      gate: result.gate,
      event: result.event,
      serverTime: result.serverTime,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
      },
    },
  );
}
