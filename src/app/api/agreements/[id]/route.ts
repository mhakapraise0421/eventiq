import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOrganizerProfile } from "@/lib/admin";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import {
  acceptAgreement,
  requestAgreementChanges,
  saveAgreement,
  sendAgreement,
} from "@/lib/agreements";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);

  const { id } = await params;
  const body = await readJson<{
    action?: "save" | "send" | "accept" | "request_changes";
    fee?: unknown;
    deposit?: unknown;
    depositDueOn?: string;
    balanceDueOn?: string;
    cancellationTerms?: string;
    transportArrangements?: string;
    accommodationArrangements?: string;
    technicalRequirements?: string;
    responsibilities?: string;
    additionalConditions?: string;
    changeSummary?: string;
    note?: string;
  }>(request);
  if (!body?.action) return jsonError("Unknown action.");

  const ip = clientIp(request);

  if (body.action === "save" || body.action === "send") {
    if (user.role !== "organizer") return jsonError("Not authorised.", 403);
    const profile = getOrganizerProfile(user.id);
    if (!profile || profile.status !== "approved") {
      return jsonError("Your organizer account must be approved first.", 403);
    }
    const limited = rateLimit(`agreement-${body.action}:${user.id}`, 60, 60 * 60_000);
    if (!limited.ok) return jsonError("Too many agreement changes. Please wait and try again.", 429);

    const result =
      body.action === "send"
        ? sendAgreement(id, user, ip)
        : saveAgreement(
            id,
            user,
            {
              fee: body.fee,
              deposit: body.deposit,
              depositDueOn: body.depositDueOn,
              balanceDueOn: body.balanceDueOn,
              cancellationTerms: body.cancellationTerms,
              transportArrangements: body.transportArrangements,
              accommodationArrangements: body.accommodationArrangements,
              technicalRequirements: body.technicalRequirements,
              responsibilities: body.responsibilities,
              additionalConditions: body.additionalConditions,
              changeSummary: body.changeSummary,
            },
            ip,
          );
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "accept" || body.action === "request_changes") {
    if (user.role !== "artist") return jsonError("Not authorised.", 403);
    const limited = rateLimit(`agreement-respond:${user.id}`, 60, 60 * 60_000);
    if (!limited.ok) return jsonError("Too many agreement changes. Please wait and try again.", 429);

    const result =
      body.action === "accept"
        ? acceptAgreement(id, user, ip)
        : requestAgreementChanges(id, user, body.note, ip);
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true });
  }

  return jsonError("Unknown action.", 400);
}
