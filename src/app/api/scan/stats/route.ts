import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { getRecentScans, getScanCounts, isAssignedToEvent } from "@/lib/gate";
import { mfaSatisfied } from "@/lib/mfa";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !["gate", "admin", "ceo"].includes(user.role)) {
    return jsonError("Not authorised.", 403);
  }
  if (!mfaSatisfied(user)) {
    return jsonError("Two-factor authentication is required for scanning.", 403);
  }

  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!eventId) return jsonError("Missing event.");

  const bypass = user.role === "admin" || user.role === "ceo";
  if (!bypass && user.role === "gate" && !isAssignedToEvent(user.id, eventId)) {
    return jsonError("You are not assigned to this event.", 403);
  }

  return NextResponse.json(
    {
      counts: getScanCounts(eventId),
      recent: getRecentScans(eventId, 15),
      updatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
