import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, readJson, sameOrigin } from "@/lib/api";
import {
  setArtistVisibility,
  updateArtistProfile,
  validateArtistProfileInput,
} from "@/lib/artists";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);
  if (user.role !== "artist") return jsonError("Not authorised.", 403);

  const body = await readJson<{
    action?: "save" | "publish" | "unpublish";
    stageName?: string;
    category?: string;
    genres?: string[];
    bio?: string;
    city?: string;
    region?: string;
    profileImage?: string;
    coverImage?: string;
    website?: string;
    instagram?: string;
    facebook?: string;
    x?: string;
    tiktok?: string;
    youtube?: string;
    media?: Array<{ label?: string; url?: string }>;
    performanceHistory?: string;
    availabilityNote?: string;
    bookingPrefs?: string;
    technicalRider?: string;
  }>(request);
  if (!body) return jsonError("Invalid request body.");
  const action = body.action || "save";
  if (!["save", "publish", "unpublish"].includes(action)) {
    return jsonError("Unknown action.");
  }

  if (action !== "unpublish") {
    if (!Array.isArray(body.genres || [])) return jsonError("Choose your genres from the list.");
    if (!Array.isArray(body.media || [])) return jsonError("Check your media links.");
    const validated = validateArtistProfileInput({
      stageName: body.stageName,
      category: body.category,
      genres: body.genres || [],
      bio: body.bio,
      city: body.city,
      region: body.region,
      profileImage: body.profileImage,
      coverImage: body.coverImage,
      website: body.website,
      instagram: body.instagram,
      facebook: body.facebook,
      x: body.x,
      tiktok: body.tiktok,
      youtube: body.youtube,
      media: (body.media || []).map((item) => ({
        label: item.label || "",
        url: item.url || "",
      })),
      performanceHistory: body.performanceHistory,
      availabilityNote: body.availabilityNote,
      bookingPrefs: body.bookingPrefs,
      technicalRider: body.technicalRider,
    });
    if (!validated.ok) return jsonError(validated.error);
    const saved = updateArtistProfile(user.id, validated.value, user);
    if (!saved.ok) return jsonError(saved.error);
  }

  if (action !== "save") {
    const result = setArtistVisibility(
      user.id,
      action === "publish" ? "published" : "draft",
      user,
    );
    if (!result.ok) return jsonError(result.error);
  }

  return NextResponse.json({ ok: true });
}
