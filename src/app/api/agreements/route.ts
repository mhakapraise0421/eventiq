import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOrganizerProfile } from "@/lib/admin";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { createAgreement } from "@/lib/agreements";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);
  if (user.role !== "organizer") return jsonError("Not authorised.", 403);

  const profile = getOrganizerProfile(user.id);
  if (!profile || profile.status !== "approved") {
    return jsonError("Your organizer account must be approved first.", 403);
  }

  const limited = rateLimit(`agreement-create:${user.id}`, 30, 60 * 60_000);
  if (!limited.ok) return jsonError("Too many agreements created. Please wait and try again.", 429);

  const body = await readJson<Record<string, unknown>>(request);
  if (!body) return jsonError("Invalid request body.");

  const result = createAgreement(
    {
      bookingId: typeof body.bookingId === "string" ? body.bookingId : undefined,
      fee: body.fee,
      deposit: body.deposit,
      depositDueOn: typeof body.depositDueOn === "string" ? body.depositDueOn : undefined,
      balanceDueOn: typeof body.balanceDueOn === "string" ? body.balanceDueOn : undefined,
      cancellationTerms:
        typeof body.cancellationTerms === "string" ? body.cancellationTerms : undefined,
      transportArrangements:
        typeof body.transportArrangements === "string" ? body.transportArrangements : undefined,
      accommodationArrangements:
        typeof body.accommodationArrangements === "string"
          ? body.accommodationArrangements
          : undefined,
      technicalRequirements:
        typeof body.technicalRequirements === "string" ? body.technicalRequirements : undefined,
      responsibilities:
        typeof body.responsibilities === "string" ? body.responsibilities : undefined,
      additionalConditions:
        typeof body.additionalConditions === "string" ? body.additionalConditions : undefined,
    },
    user,
    clientIp(request),
  );
  if (!result.ok) return jsonError(result.error);
  return NextResponse.json({ ok: true, agreementId: result.agreementId });
}
