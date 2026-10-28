import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, readJson, sameOrigin } from "@/lib/api";
import { submitArtistVerification } from "@/lib/artists";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);
  if (user.role !== "artist") return jsonError("Not authorised.", 403);

  const body = await readJson<{ note?: string; documentIds?: string[] }>(request);
  if (!body) return jsonError("Invalid request body.");
  const documentIds = Array.isArray(body.documentIds) ? body.documentIds : [];
  if (!documentIds.length) {
    return jsonError("Upload at least one identity document before requesting verification.");
  }
  if (documentIds.length > 4) return jsonError("Attach up to 4 documents.");
  if (documentIds.some((id) => typeof id !== "string" || id.length > 80)) {
    return jsonError("One of the selected documents is invalid.");
  }

  const result = submitArtistVerification(user.id, {
    note: (body.note || "").trim().slice(0, 500),
    documentIds,
    actor: user,
  });
  if (!result.ok) return jsonError(result.error);
  return NextResponse.json({ ok: true, requestId: result.requestId });
}
