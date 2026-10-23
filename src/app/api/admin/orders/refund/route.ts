import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, readJson, sameOrigin } from "@/lib/api";
import { refundOrder } from "@/lib/orders";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "ceo")) {
    return jsonError("Not authorised.", 403);
  }

  const body = await readJson<{ orderId?: string }>(request);
  if (!body?.orderId) return jsonError("Select an order to refund.");

  const result = refundOrder(body.orderId);
  if (!result.ok) return jsonError(result.error);

  writeAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "order.refunded",
    entityType: "order",
    entityId: body.orderId,
    after: { refunded_cents: result.refundedCents },
    ip: request.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ ok: true, refundedCents: result.refundedCents });
}
