import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { createInvoice, voidInvoice } from "@/lib/agreements";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);
  if (user.role !== "artist") return jsonError("Not authorised.", 403);

  const { id } = await params;
  const body = await readJson<{
    action?: "create" | "void";
    amount?: unknown;
    description?: string;
    dueOn?: string;
    invoiceId?: string;
  }>(request);
  if (!body?.action) return jsonError("Unknown action.");

  const ip = clientIp(request);

  if (body.action === "create") {
    const limited = rateLimit(`invoice-create:${user.id}`, 30, 60 * 60_000);
    if (!limited.ok) return jsonError("Too many invoices created. Please wait and try again.", 429);
    const result = createInvoice(
      {
        agreementId: id,
        amount: body.amount,
        description: body.description,
        dueOn: body.dueOn,
      },
      user,
      ip,
    );
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true, invoiceId: result.invoiceId, number: result.number });
  }

  if (body.action === "void") {
    if (!body.invoiceId) return jsonError("Select an invoice.");
    const limited = rateLimit(`invoice-void:${user.id}`, 30, 60 * 60_000);
    if (!limited.ok) return jsonError("Too many changes. Please wait and try again.", 429);
    const result = voidInvoice(body.invoiceId, user, ip);
    if (!result.ok) return jsonError(result.error);
    return NextResponse.json({ ok: true });
  }

  return jsonError("Unknown action.", 400);
}
