import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOrganizerProfile } from "@/lib/admin";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { confirmPayment, markPaymentFailed, recordPayment } from "@/lib/agreements";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);

  const { id } = await params;
  const body = await readJson<{
    action?: "record" | "confirm" | "failed";
    paymentId?: string;
    amount?: unknown;
    paidOn?: string;
    method?: string;
    reference?: string;
    note?: string;
    invoiceId?: string;
  }>(request);
  if (!body?.action) return jsonError("Unknown action.");

  const ip = clientIp(request);

  if (body.action === "record") {
    if (user.role !== "organizer") return jsonError("Not authorised.", 403);
    const profile = getOrganizerProfile(user.id);
    if (!profile || profile.status !== "approved") {
      return jsonError("Your organizer account must be approved first.", 403);
    }
    const limited = rateLimit(`payment-record:${user.id}`, 60, 60 * 60_000);
    if (!limited.ok) return jsonError("Too many payment records. Please wait and try again.", 429);

    const result = recordPayment(
      {
        agreementId: id,
        amount: body.amount,
        paidOn: body.paidOn,
        method: body.method,
        reference: body.reference,
        note: body.note,
        invoiceId: body.invoiceId,
      },
      user,
      ip,
    );
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true, paymentId: result.paymentId });
  }

  if (!body.paymentId) return jsonError("Select a payment.");

  if (body.action === "confirm") {
    if (user.role !== "artist") return jsonError("Not authorised.", 403);
    const limited = rateLimit(`payment-confirm:${user.id}`, 60, 60 * 60_000);
    if (!limited.ok) return jsonError("Too many changes. Please wait and try again.", 429);
    const result = confirmPayment(body.paymentId, user, ip);
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "failed") {
    if (user.role !== "organizer") return jsonError("Not authorised.", 403);
    const profile = getOrganizerProfile(user.id);
    if (!profile || profile.status !== "approved") {
      return jsonError("Your organizer account must be approved first.", 403);
    }
    const limited = rateLimit(`payment-failed:${user.id}`, 30, 60 * 60_000);
    if (!limited.ok) return jsonError("Too many changes. Please wait and try again.", 429);
    const result = markPaymentFailed(body.paymentId, user, ip);
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true });
  }

  return jsonError("Unknown action.", 400);
}
