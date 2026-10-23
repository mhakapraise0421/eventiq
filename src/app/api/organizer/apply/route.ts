import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, readJson, sameOrigin } from "@/lib/api";
import { upsertOrganizerApplication } from "@/lib/organizer";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in to apply.", 401);

  const body = await readJson<{
    businessName?: string;
    businessType?: string;
    registrationNo?: string;
    city?: string;
    website?: string;
    description?: string;
    kycDocument?: string;
  }>(request);
  if (!body) return jsonError("Invalid request body.");

  const businessName = (body.businessName || "").trim();
  const businessType = (body.businessType || "").trim();
  const description = (body.description || "").trim();
  if (businessName.length < 2) return jsonError("Enter your business or promoter name.");
  if (businessType.length < 2) return jsonError("Select your business type.");
  if (description.length < 30) {
    return jsonError("Tell us about your events in at least 30 characters.");
  }
  const website = (body.website || "").trim();
  if (website && !/^https?:\/\//i.test(website)) {
    return jsonError("Website must start with http:// or https://");
  }

  const result = upsertOrganizerApplication(
    user.id,
    {
      businessName,
      businessType,
      registrationNo: (body.registrationNo || "").trim(),
      city: (body.city || "").trim(),
      website,
      description,
      kycDocument: (body.kycDocument || "").trim(),
    },
    user,
  );

  if (!result.ok) return jsonError(result.error);
  return NextResponse.json({ ok: true });
}
