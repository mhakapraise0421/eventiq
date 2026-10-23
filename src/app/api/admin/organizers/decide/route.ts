import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, readJson, sameOrigin } from "@/lib/api";
import { decideOrganizerApplication } from "@/lib/admin";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "ceo")) {
    return jsonError("Not authorised.", 403);
  }

  const body = await readJson<{
    userId?: string;
    decision?: "approved" | "requires_modification" | "rejected";
    note?: string;
  }>(request);
  if (!body?.userId || !body.decision) return jsonError("Invalid decision payload.");
  if (!["approved", "requires_modification", "rejected"].includes(body.decision)) {
    return jsonError("Unknown decision.");
  }
  if (body.decision !== "approved" && !body.note?.trim()) {
    return jsonError("Add a note explaining the decision.");
  }

  const result = decideOrganizerApplication(
    body.userId,
    body.decision,
    body.note?.trim() || "",
    user,
    request.headers.get("x-forwarded-for"),
  );
  if (!result.ok) return jsonError(result.error);
  return NextResponse.json({ ok: true });
}
