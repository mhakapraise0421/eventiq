import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, readJson, sameOrigin } from "@/lib/api";
import { decideArtistVerification } from "@/lib/artists";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "ceo")) {
    return jsonError("Not authorised.", 403);
  }

  const body = await readJson<{
    requestId?: string;
    decision?: "verified" | "requires_info" | "rejected";
    note?: string;
  }>(request);
  if (!body?.requestId || !body.decision) return jsonError("Invalid decision payload.");
  if (!["verified", "requires_info", "rejected"].includes(body.decision)) {
    return jsonError("Unknown decision.");
  }

  const result = decideArtistVerification(
    body.requestId,
    body.decision,
    body.note || "",
    user,
    request.headers.get("x-forwarded-for"),
  );
  if (!result.ok) return jsonError(result.error);
  return NextResponse.json({ ok: true });
}
