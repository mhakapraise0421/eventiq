import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, sameOrigin } from "@/lib/api";
import { createArtistDocument } from "@/lib/artists";
import { MAX_DOCUMENT_BYTES } from "@/lib/artist-options";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);
  if (user.role !== "artist") return jsonError("Not authorised.", 403);

  const limited = rateLimit(`artist-docs:${user.id}`, 20, 60 * 60_000);
  if (!limited.ok) {
    return jsonError("Too many uploads. Try again later.", 429);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Upload a file using the document form.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Choose a file to upload.");
  if (file.size === 0) return jsonError("That file is empty.");
  if (file.size > MAX_DOCUMENT_BYTES) {
    return jsonError("Documents must be 5 MB or smaller.");
  }
  const label = String(form.get("label") || "").trim().slice(0, 60);
  if (label.length < 2) {
    return jsonError("Give the document a label, for example “National ID”.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await createArtistDocument({
    artistId: user.id,
    label,
    fileName: file.name || "document",
    bytes,
    actor: user,
  });
  if (!result.ok) return jsonError(result.error);

  return NextResponse.json({
    ok: true,
    document: {
      id: result.documentId,
      label,
      size: bytes.length,
    },
  });
}
