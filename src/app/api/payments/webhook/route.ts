import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { markOrderPaidByReference } from "@/lib/orders";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-eventiq-signature") || "";
  const secret = process.env.PAYMENT_WEBHOOK_SECRET || "eventiq-dev-webhook-secret";
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: {
    event?: string;
    data?: {
      reference?: string;
      provider?: string;
      method?: string;
      paymentRef?: string;
      amountCents?: number;
    };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (payload.event !== "payment.succeeded") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const data = payload.data;
  if (!data?.reference) {
    return NextResponse.json({ error: "Missing order reference." }, { status: 400 });
  }

  const result = markOrderPaidByReference(
    data.reference,
    data.provider || "provider",
    data.method || "card",
    data.paymentRef || `WEBHOOK-${data.reference}`,
  );

  if (!result.ok) {
    writeAudit({
      actorId: null,
      actorName: data.provider || "payment-provider",
      actorRole: "system",
      action: "payment.webhook_failed",
      entityType: "order",
      entityId: data.reference,
      outcome: "failure",
      after: { error: result.error, amountCents: data.amountCents },
    });
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  writeAudit({
    actorId: null,
    actorName: data.provider || "payment-provider",
    actorRole: "system",
    action: "payment.webhook_processed",
    entityType: "order",
    entityId: data.reference,
    after: { alreadyPaid: result.alreadyPaid, paymentRef: data.paymentRef },
  });

  return NextResponse.json({ ok: true, alreadyProcessed: result.alreadyPaid });
}
