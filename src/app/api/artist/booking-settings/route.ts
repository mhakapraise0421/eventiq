import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { setAcceptingBookings } from "@/lib/bookings";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);
  if (user.role !== "artist") return jsonError("Not authorised.", 403);

  const limited = rateLimit(`booking-settings:${user.id}`, 30, 60 * 60_000);
  if (!limited.ok) return jsonError("Too many changes. Please wait and try again.", 429);

  const body = await readJson<{ accepting?: boolean }>(request);
  if (!body || typeof body.accepting !== "boolean") {
    return jsonError("Choose whether to accept booking requests.");
  }

  const result = setAcceptingBookings(user.id, body.accepting, user, clientIp(request));
  if (!result.ok) return jsonError(result.error);
  return NextResponse.json({ ok: true, accepting: body.accepting });
}
