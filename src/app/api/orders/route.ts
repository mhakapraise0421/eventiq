import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { createOrder, payOrder, type RequestedTier } from "@/lib/orders";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in to continue.", 401);

  const limited = rateLimit(`order:${user.id}`, 12, 60_000);
  if (!limited.ok) {
    return jsonError("Too many checkout attempts. Please wait a moment.", 429);
  }

  const body = await readJson<{
    eventId?: string;
    items?: RequestedTier[];
    idempotencyKey?: string;
  }>(request);
  if (!body?.eventId || !Array.isArray(body.items)) {
    return jsonError("Invalid order request.");
  }

  const items = body.items
    .filter(
      (item) =>
        item &&
        typeof item.ticketTypeId === "string" &&
        Number.isFinite(Number(item.quantity)) &&
        Number(item.quantity) > 0,
    )
    .map((item) => ({
      ticketTypeId: item.ticketTypeId,
      quantity: Math.min(10, Math.floor(Number(item.quantity))),
    }));

  const result = createOrder(
    user.id,
    body.eventId,
    items,
    body.idempotencyKey?.slice(0, 80),
  );

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  if (result.totalCents === 0) {
    const paid = payOrder(result.orderId, user.id, "free");
    if (!paid.ok) return jsonError(paid.error, 400);
    return NextResponse.json({
      ok: true,
      orderId: result.orderId,
      reference: result.reference,
      totalCents: 0,
      free: true,
    });
  }

  return NextResponse.json({
    ok: true,
    orderId: result.orderId,
    reference: result.reference,
    totalCents: result.totalCents,
    free: false,
  });
}
