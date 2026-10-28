import { NextResponse } from "next/server";
import { all } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getOrganizerProfile } from "@/lib/admin";
import { mfaSatisfied } from "@/lib/mfa";

interface SalesRow {
  reference: string;
  event_title: string;
  event_starts_at: string;
  user_name: string;
  user_email: string;
  quantity: number;
  subtotal_cents: number;
  fee_cents: number;
  total_cents: number;
  commission_cents: number;
  refunded_cents: number;
  status: string;
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
}

function cell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Spreadsheet apps run cells that start with =, @, tab or a signed expression.
  // A leading apostrophe keeps user-supplied text inert.
  const numeric = /^[+-]?\d+(\.\d+)?$/.test(text);
  if (/^[=@\t\r]/.test(text) || (!numeric && /^[+-]/.test(text))) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function money(cents: number) {
  return (Number(cents || 0) / 100).toFixed(2);
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");

  let organizerId: string | null = null;
  if (user.role === "organizer") {
    const profile = getOrganizerProfile(user.id);
    if (!profile || profile.status !== "approved") {
      return NextResponse.json({ error: "Organizer account not approved." }, { status: 403 });
    }
    organizerId = user.id;
  } else if (user.role !== "admin" && user.role !== "ceo") {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  if (!mfaSatisfied(user)) {
    return NextResponse.json(
      { error: "Two-factor authentication is required to export sales data." },
      { status: 403 },
    );
  }

  const clauses: string[] = [];
  const params: string[] = [];
  if (organizerId) {
    clauses.push("e.organizer_id = ?");
    params.push(organizerId);
  }
  if (eventId) {
    clauses.push("o.event_id = ?");
    params.push(eventId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const rows = all<SalesRow>(
    `SELECT o.reference, e.title AS event_title, e.starts_at AS event_starts_at,
            u.name AS user_name, u.email AS user_email,
            COALESCE((SELECT SUM(quantity) FROM order_items WHERE order_id = o.id), 0) AS quantity,
            o.subtotal_cents, o.fee_cents, o.total_cents, o.commission_cents, o.refunded_cents,
            o.status, o.payment_method, o.paid_at, o.created_at
     FROM orders o
     JOIN events e ON e.id = o.event_id
     JOIN users u ON u.id = o.user_id
     ${where}
     ORDER BY o.created_at DESC`,
    ...params,
  );

  const header = [
    "Order reference",
    "Event",
    "Event date",
    "Attendee",
    "Email",
    "Tickets",
    "Subtotal (USD)",
    "Service fee (USD)",
    "Total (USD)",
    "Commission (USD)",
    "Refunded (USD)",
    "Status",
    "Payment method",
    "Paid at",
    "Ordered at",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        cell(row.reference),
        cell(row.event_title),
        cell(row.event_starts_at),
        cell(row.user_name),
        cell(row.user_email),
        cell(row.quantity),
        cell(money(row.subtotal_cents)),
        cell(money(row.fee_cents)),
        cell(money(row.total_cents)),
        cell(money(row.commission_cents)),
        cell(money(row.refunded_cents)),
        cell(row.status),
        cell(row.payment_method),
        cell(row.paid_at),
        cell(row.created_at),
      ].join(","),
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="eventiq-sales-${stamp}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
