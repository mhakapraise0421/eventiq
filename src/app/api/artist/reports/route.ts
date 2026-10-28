import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getArtistProfile } from "@/lib/artists";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { createArtistReport } from "@/lib/artist-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);
  if (user.role !== "artist") return jsonError("Not authorised.", 403);

  const profile = getArtistProfile(user.id);
  if (!profile) return jsonError("Create an artist profile first.", 403);

  const limited = rateLimit(`artist-report:${user.id}`, 10, 60 * 60_000);
  if (!limited.ok) {
    return jsonError("Too many reports generated. Please wait an hour and try again.", 429);
  }

  const body = await readJson<Record<string, unknown>>(request);
  if (!body) return jsonError("Invalid request body.");

  const result = await createArtistReport(body, user, profile.stage_name, clientIp(request));
  if (!result.ok) return jsonError(result.error, 400);
  return NextResponse.json({
    ok: true,
    reportId: result.reportId,
    sha256: result.report.pdf_sha256,
  });
}
