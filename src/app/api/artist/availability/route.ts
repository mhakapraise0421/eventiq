import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { addAvailability, removeAvailability } from "@/lib/bookings";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);
  if (user.role !== "artist") return jsonError("Not authorised.", 403);

  const body = await readJson<{
    action?: "add" | "remove";
    availabilityId?: string;
    startsAt?: string;
    endsAt?: string;
    note?: string;
  }>(request);
  if (!body) return jsonError("Invalid request body.");

  const ip = clientIp(request);

  if (body.action === "add") {
    const limited = rateLimit(`availability:${user.id}`, 40, 60 * 60_000);
    if (!limited.ok) return jsonError("Too many calendar changes. Please wait and try again.", 429);
    const result = addAvailability(
      { startsAt: body.startsAt, endsAt: body.endsAt, note: body.note },
      user,
      ip,
    );
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "remove") {
    if (!body.availabilityId) return jsonError("Select an unavailable block.");
    const limited = rateLimit(`availability-remove:${user.id}`, 60, 60 * 60_000);
    if (!limited.ok) return jsonError("Too many calendar changes. Please wait and try again.", 429);
    const result = removeAvailability(body.availabilityId, user, ip);
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true });
  }

  return jsonError("Unknown action.", 400);
}
