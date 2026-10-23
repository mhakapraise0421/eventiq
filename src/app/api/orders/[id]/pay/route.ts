import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { getOrderForUser, payOrder } from "@/lib/orders";
import { rateLimit } from "@/lib/rate-limit";

const ALLOWED_METHODS = new Set(["ecocash", "card", "bank", "free"]);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in to continue.", 401);

  const { id } = await context.params;
  const limited = rateLimit(`pay:${user.id}`, 10, 60_000);
  if (!limited.ok) {
    return jsonError("Too many payment attempts. Please wait a moment.", 429);
  }

  const body = await readJson<{ method?: string }>(request);
  const method = body?.method || "card";
  if (!ALLOWED_METHODS.has(method)) {
    return jsonError("Unsupported payment method.");
  }

  const order = getOrderForUser(id, user.id);
  if (!order) return jsonError("Order not found.", 404);

  if (order.status === "paid") {
    return NextResponse.json({ ok: true, alreadyPaid: true, orderId: order.id });
  }

  const result = payOrder(order.id, user.id, method);
  if (!result.ok) return jsonError(result.error, 400);

  return NextResponse.json({
    ok: true,
    alreadyPaid: result.alreadyPaid,
    orderId: order.id,
    reference: order.reference,
  });
}
