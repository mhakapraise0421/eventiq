import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, jsonError } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { getTicketForUser } from "@/lib/orders";
import { writeAudit } from "@/lib/audit";
import { buildTicketPdf } from "@/lib/ticket-pdf";
import { slugify } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in to download this ticket.", 401);

  const limited = rateLimit(`ticket-pdf:${user.id}`, 30, 60_000);
  if (!limited.ok) {
    return jsonError("Too many downloads. Please try again in a minute.", 429);
  }

  const { id } = await params;
  const ticket = getTicketForUser(id, user.id);
  if (!ticket) return jsonError("Ticket not found.", 404);

  if (ticket.status === "void") {
    return jsonError(
      "This ticket has been voided or refunded, so it can't be downloaded for entry.",
      409,
    );
  }

  try {
    const pdf = await buildTicketPdf(ticket);
    const filename = `EventIQ-${slugify(ticket.event_title || "ticket")}-${ticket.code}.pdf`;

    writeAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "ticket.pdf_downloaded",
      entityType: "ticket",
      entityId: ticket.id,
      after: { code: ticket.code, status: ticket.status },
      ip: clientIp(request),
    });

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Ticket PDF generation failed", error);
    return jsonError("Could not create the ticket PDF. Please try again.", 500);
  }
}
