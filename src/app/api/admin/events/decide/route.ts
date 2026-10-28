import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, readJson, sameOrigin } from "@/lib/api";
import { decideEvent } from "@/lib/admin";
import { mfaSatisfied } from "@/lib/mfa";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "ceo")) {
    return jsonError("Not authorised.", 403);
  }
  if (!mfaSatisfied(user)) {
    return jsonError("Two-factor authentication is required for this action.", 403);
  }

  const body = await readJson<{
    eventId?: string;
    decision?: "approved" | "rejected" | "cancelled";
    reason?: string;
  }>(request);
  if (!body?.eventId || !body.decision) return jsonError("Invalid decision payload.");
  if (!["approved", "rejected", "cancelled"].includes(body.decision)) {
    return jsonError("Unknown decision.");
  }
  if (body.decision !== "approved" && !body.reason?.trim()) {
    return jsonError("Add a reason for this decision.");
  }

  const result = decideEvent(
    body.eventId,
    body.decision,
    body.reason?.trim() || "",
    user,
    request.headers.get("x-forwarded-for"),
  );
  if (!result.ok) return jsonError(result.error);
  return NextResponse.json({ ok: true });
}
