import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOrganizerProfile } from "@/lib/admin";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { createBookingRequest, withdrawBooking } from "@/lib/bookings";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);
  if (user.role !== "organizer") {
    return jsonError("Only organizer accounts can request artist bookings.", 403);
  }
  const profile = getOrganizerProfile(user.id);
  if (!profile || profile.status !== "approved") {
    return jsonError("Your organizer account must be approved first.", 403);
  }

  const body = await readJson<{
    action?: "create" | "withdraw";
    artistId?: string;
    eventId?: string;
    proposedFee?: string | number;
    message?: string;
    bookingId?: string;
  }>(request);
  if (!body) return jsonError("Invalid request body.");

  const ip = clientIp(request);

  if (body.action === "create") {
    const limited = rateLimit(`booking-create:${user.id}`, 30, 60 * 60_000);
    if (!limited.ok) {
      return jsonError("Too many booking requests. Please wait before sending more.", 429);
    }
    const result = createBookingRequest(
      {
        artistId: body.artistId,
        eventId: body.eventId,
        proposedFee: body.proposedFee,
        message: body.message,
      },
      user,
      ip,
    );
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true, bookingId: result.bookingId });
  }

  if (body.action === "withdraw") {
    if (!body.bookingId) return jsonError("Select a booking request.");
    const limited = rateLimit(`booking-withdraw:${user.id}`, 60, 60 * 60_000);
    if (!limited.ok) return jsonError("Too many changes. Please wait and try again.", 429);
    const result = withdrawBooking(body.bookingId, user, ip);
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true });
  }

  return jsonError("Unknown action.", 400);
}
