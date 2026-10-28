import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, sameOrigin } from "@/lib/api";
import { findArtistDocument, removeArtistDocument } from "@/lib/artists";
import { readPrivateFile } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);
  const { id } = await params;
  const document = findArtistDocument(id);
  if (!document) return jsonError("Document not found.", 404);

  const isOwner = document.artist_id === user.id;
  const isReviewer = user.role === "admin" || user.role === "ceo";
  if (!isOwner && !isReviewer) return jsonError("Not authorised.", 403);

  let bytes: Buffer;
  try {
    bytes = await readPrivateFile(document.storage_path);
  } catch {
    return jsonError("The stored file is unavailable. Ask the artist to upload it again.", 410);
  }

  const extension = document.mime === "application/pdf" ? "pdf" : document.mime === "image/png" ? "png" : "jpg";
  const safeName = document.label.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "artist-document";
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": document.mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="${safeName}.${extension}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);
  if (user.role !== "artist") return jsonError("Not authorised.", 403);
  const { id } = await params;
  const result = await removeArtistDocument(user.id, id, user);
  if (!result.ok) return jsonError(result.error);
  return NextResponse.json({ ok: true });
}
