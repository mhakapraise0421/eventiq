import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, readJson, sameOrigin } from "@/lib/api";
import { getOrganizerProfile } from "@/lib/admin";
import { createPriceRequest } from "@/lib/organizer";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);

  const profile = getOrganizerProfile(user.id);
  if (!profile || profile.status !== "approved") {
    return jsonError("Your organizer account must be approved.", 403);
  }

  const body = await readJson<{
    eventId?: string;
    ticketTypeId?: string;
    newPriceCents?: number;
    note?: string;
  }>(request);
  if (!body?.eventId || !body?.ticketTypeId) {
    return jsonError("Select a ticket type to update.");
  }

  const result = createPriceRequest(
    body.eventId,
    body.ticketTypeId,
    Number(body.newPriceCents),
    body.note || "",
    user.id,
    user,
  );
  if (!result.ok) return jsonError(result.error);
  return NextResponse.json({ ok: true, requestId: result.requestId });
}
