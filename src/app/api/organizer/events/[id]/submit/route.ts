import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, sameOrigin } from "@/lib/api";
import { getOrganizerProfile } from "@/lib/admin";
import { submitOrganizerEvent } from "@/lib/organizer";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);

  const profile = getOrganizerProfile(user.id);
  if (!profile || profile.status !== "approved") {
    return jsonError("Your organizer account must be approved.", 403);
  }

  const { id } = await params;
  const result = submitOrganizerEvent(id, user.id, user);
  if (!result.ok) return jsonError(result.error);
  return NextResponse.json({ ok: true });
}
