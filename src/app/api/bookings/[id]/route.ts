import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { acceptBooking, cancelBooking, declineBooking } from "@/lib/bookings";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);
  if (user.role !== "artist") return jsonError("Not authorised.", 403);

  const { id } = await params;
  const body = await readJson<{
    action?: "accept" | "decline" | "cancel";
    note?: string;
  }>(request);
  if (!body?.action) return jsonError("Unknown action.");

  const limited = rateLimit(`booking-respond:${user.id}`, 60, 60 * 60_000);
  if (!limited.ok) return jsonError("Too many changes. Please wait and try again.", 429);

  const ip = clientIp(request);
  const result =
    body.action === "accept"
      ? acceptBooking(id, user, ip)
      : body.action === "decline"
        ? declineBooking(id, user, body.note, ip)
        : body.action === "cancel"
          ? cancelBooking(id, user, body.note, ip)
          : { ok: false as const, error: "Unknown action." };

  if (!result.ok) return jsonError(result.error);
  return NextResponse.json({ ok: true });
}
