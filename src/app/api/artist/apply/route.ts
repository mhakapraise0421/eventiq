import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, readJson, sameOrigin } from "@/lib/api";
import { upsertArtistApplication, validateArtistProfileInput } from "@/lib/artists";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in to apply.", 401);
  if (user.role !== "attendee" && user.role !== "artist") {
    return jsonError(
      "Artist accounts need a dedicated login. Contact support to split an organizer or staff account.",
      403,
    );
  }

  const body = await readJson<{
    stageName?: string;
    category?: string;
    genres?: string[];
    bio?: string;
    city?: string;
    region?: string;
  }>(request);
  if (!body) return jsonError("Invalid request body.");
  if (!Array.isArray(body.genres || [])) return jsonError("Choose your genres from the list.");

  const validated = validateArtistProfileInput({
    stageName: body.stageName,
    category: body.category,
    genres: body.genres || [],
    bio: body.bio,
    city: body.city,
    region: body.region,
  });
  if (!validated.ok) return jsonError(validated.error);

  const result = upsertArtistApplication(user.id, validated.value, user);
  if (!result.ok) return jsonError(result.error);
  return NextResponse.json({ ok: true });
}
