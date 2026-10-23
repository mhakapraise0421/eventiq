import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordEventView } from "@/lib/attendee";
import { jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const limited = rateLimit(`view:${user.id}`, 60, 60_000);
  if (!limited.ok) return NextResponse.json({ ok: false }, { status: 429 });

  const body = await readJson<{ eventId?: string }>(request);
  if (!body?.eventId || typeof body.eventId !== "string") {
    return jsonError("Invalid request.");
  }

  recordEventView(user.id, body.eventId);
  return NextResponse.json({ ok: true });
}
