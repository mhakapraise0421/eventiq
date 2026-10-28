import "server-only";
import { all, get, transaction } from "./db";
import type { Order, OrderItem, OrderStatus, Ticket, TicketType } from "./types";
import {
  COMMISSION_RATE,
  RESERVATION_MINUTES,
  SERVICE_FEE_RATE,
  orderReference,
  randomId,
  ticketCode,
} from "./format";

const ORDER_SELECT = `
  SELECT o.*, e.title AS event_title, e.slug AS event_slug, e.starts_at AS event_starts_at,
         e.cover_image AS event_cover, u.name AS user_name, u.email AS user_email
  FROM orders o
  JOIN events e ON e.id = o.event_id
  JOIN users u ON u.id = o.user_id
`;

export interface RequestedTier {
  ticketTypeId: string;
  quantity: number;
}

export type CreateOrderResult =
  | { ok: true; orderId: string; reference: string; totalCents: number }
  | { ok: false; error: string; status: number };

export function releaseExpiredOrders() {
  const now = new Date().toISOString();
  transaction((db) => {
    const expired = db
      .prepare("SELECT id FROM orders WHERE status = 'pending' AND expires_at < ?")
      .all(now) as { id: string }[];
    for (const order of expired) {
      const items = db
        .prepare("SELECT ticket_type_id, quantity FROM order_items WHERE order_id = ?")
        .all(order.id) as { ticket_type_id: string; quantity: number }[];
      for (const item of items) {
        db.prepare(
          "UPDATE ticket_types SET sold = MAX(0, sold - ?) WHERE id = ?",
        ).run(item.quantity, item.ticket_type_id);
      }
      db.prepare("UPDATE orders SET status = 'expired' WHERE id = ?").run(order.id);
    }
  });
}

export function createOrder(
  userId: string,
  eventId: string,
  items: RequestedTier[],
  idempotencyKey?: string,
): CreateOrderResult {
  releaseExpiredOrders();

  if (idempotencyKey) {
    const existing = get<{ id: string; reference: string; total_cents: number }>(
      "SELECT id, reference, total_cents FROM orders WHERE idempotency_key = ? AND user_id = ?",
      idempotencyKey,
      userId,
    );
    if (existing) {
      return {
        ok: true,
        orderId: existing.id,
        reference: existing.reference,
        totalCents: existing.total_cents,
      };
    }
  }

  const requested = items
    .filter((i) => Number.isFinite(i.quantity) && i.quantity > 0)
    .reduce<Map<string, number>>((map, item) => {
      map.set(item.ticketTypeId, (map.get(item.ticketTypeId) || 0) + Math.floor(item.quantity));
      return map;
    }, new Map());

  if (requested.size === 0) {
    return { ok: false, error: "Select at least one ticket.", status: 400 };
  }

  const totalRequested = [...requested.values()].reduce((a, b) => a + b, 0);
  if (totalRequested > 10) {
    return { ok: false, error: "You can order up to 10 tickets at a time.", status: 400 };
  }

  try {
    return transaction((db) => {
      const event = db
        .prepare("SELECT id, status, starts_at FROM events WHERE id = ?")
        .get(eventId) as { id: string; status: string; starts_at: string } | undefined;
      if (!event) {
        return { ok: false as const, error: "Event not found.", status: 404 };
      }
      if (event.status !== "approved") {
        return { ok: false as const, error: "Tickets for this event are not on sale.", status: 400 };
      }
      if (new Date(event.starts_at).getTime() < Date.now()) {
        return { ok: false as const, error: "This event has already started.", status: 400 };
      }

      const now = new Date();
      const lines: Array<{
        tier: TicketType;
        quantity: number;
        unitPrice: number;
      }> = [];
      let subtotal = 0;

      for (const [tierId, quantity] of requested) {
        const tier = db
          .prepare("SELECT * FROM ticket_types WHERE id = ? AND event_id = ?")
          .get(tierId, eventId) as unknown as TicketType | undefined;
        if (!tier) {
          return { ok: false as const, error: "Ticket type not found.", status: 400 };
        }
        if (quantity > tier.max_per_order) {
          return {
            ok: false as const,
            error: `Maximum ${tier.max_per_order} tickets per order for ${tier.name}.`,
            status: 400,
          };
        }
        if (tier.sales_start && now < new Date(tier.sales_start)) {
          return { ok: false as const, error: `${tier.name} sales have not opened yet.`, status: 400 };
        }
        if (tier.sales_end && now > new Date(tier.sales_end)) {
          return { ok: false as const, error: `${tier.name} sales have closed.`, status: 400 };
        }
        const remaining = tier.capacity - tier.sold;
        if (quantity > remaining) {
          return {
            ok: false as const,
            error:
              remaining <= 0
                ? `${tier.name} is sold out.`
                : `Only ${remaining} ${tier.name} ticket${remaining === 1 ? "" : "s"} remaining.`,
            status: 409,
          };
        }
        lines.push({ tier, quantity, unitPrice: tier.price_cents });
        subtotal += tier.price_cents * quantity;
      }

      const fee = Math.round(subtotal * SERVICE_FEE_RATE);
      const commission = Math.round(subtotal * COMMISSION_RATE);
      const total = subtotal + fee;
      const orderId = randomId("ord_");
      const reference = orderReference();
      const createdAt = now.toISOString();
      const expiresAt = new Date(now.getTime() + RESERVATION_MINUTES * 60_000).toISOString();

      db.prepare(
        `INSERT INTO orders (id, reference, user_id, event_id, status, subtotal_cents, fee_cents, total_cents,
          commission_cents, refunded_cents, currency, payment_method, payment_ref, provider, idempotency_key,
          expires_at, created_at, paid_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, 0, 'USD', NULL, NULL, NULL, ?, ?, ?, NULL)`,
      ).run(
        orderId,
        reference,
        userId,
        eventId,
        subtotal,
        fee,
        total,
        commission,
        idempotencyKey || null,
        expiresAt,
        createdAt,
      );

      for (const line of lines) {
        db.prepare(
          `INSERT INTO order_items (id, order_id, ticket_type_id, quantity, unit_price_cents)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(randomId("oi_"), orderId, line.tier.id, line.quantity, line.unitPrice);
        db.prepare("UPDATE ticket_types SET sold = sold + ? WHERE id = ?").run(
          line.quantity,
          line.tier.id,
        );
      }

      return { ok: true as const, orderId, reference, totalCents: total };
    });
  } catch (error) {
    console.error("createOrder failed", error);
    return { ok: false, error: "Could not create your order. Please try again.", status: 500 };
  }
}

export function issueTickets(
  dbOrderId: string,
  method: string,
  paymentRef: string,
  provider = "simulated",
) {
  return transaction((db) => {
    const order = db
      .prepare(
        `SELECT o.*, u.name AS user_name FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?`,
      )
      .get(dbOrderId) as unknown as (Order & { user_name: string }) | undefined;

    if (!order) return { ok: false as const, error: "Order not found." };

    if (order.status === "paid") {
      const count = db
        .prepare("SELECT COUNT(*) AS count FROM tickets WHERE order_id = ?")
        .get(order.id) as { count: number };
      return { ok: true as const, alreadyPaid: true, ticketCount: Number(count.count) };
    }

    if (order.status !== "pending") {
      return { ok: false as const, error: `Order is ${order.status} and cannot be paid.` };
    }

    if (new Date(order.expires_at).getTime() < Date.now()) {
      const items = db
        .prepare("SELECT ticket_type_id, quantity FROM order_items WHERE order_id = ?")
        .all(order.id) as { ticket_type_id: string; quantity: number }[];
      for (const item of items) {
        db.prepare("UPDATE ticket_types SET sold = MAX(0, sold - ?) WHERE id = ?").run(
          item.quantity,
          item.ticket_type_id,
        );
      }
      db.prepare("UPDATE orders SET status = 'expired' WHERE id = ?").run(order.id);
      return { ok: false as const, error: "This checkout reservation has expired." };
    }

    const items = db
      .prepare("SELECT * FROM order_items WHERE order_id = ?")
      .all(order.id) as unknown as OrderItem[];
    let ticketCount = 0;
    const issuedAt = new Date().toISOString();

    for (const item of items) {
      for (let i = 0; i < item.quantity; i += 1) {
        let code = ticketCode();
        while (db.prepare("SELECT 1 FROM tickets WHERE code = ?").get(code)) {
          code = ticketCode();
        }
        db.prepare(
          `INSERT INTO tickets (id, code, order_id, ticket_type_id, event_id, holder_name, status, issued_at, used_at, used_gate, used_by)
           VALUES (?, ?, ?, ?, ?, ?, 'valid', ?, NULL, NULL, NULL)`,
        ).run(
          randomId("tkt_"),
          code,
          order.id,
          item.ticket_type_id,
          order.event_id,
          order.user_name,
          issuedAt,
        );
        ticketCount += 1;
      }
    }

    db.prepare(
      `UPDATE orders SET status = 'paid', paid_at = ?, payment_method = ?, payment_ref = ?, provider = ?
       WHERE id = ? AND status = 'pending'`,
    ).run(issuedAt, method, paymentRef, provider, order.id);

    return { ok: true as const, alreadyPaid: false, ticketCount };
  });
}

export function payOrder(orderId: string, userId: string, method: string) {
  const order = get<Order>("SELECT * FROM orders WHERE id = ? AND user_id = ?", orderId, userId);
  if (!order) return { ok: false as const, error: "Order not found." };
  if (order.status === "paid") return { ok: true as const, alreadyPaid: true };
  if (order.status !== "pending") {
    return { ok: false as const, error: `This order is ${order.status}.` };
  }
  const paymentRef = `PAY-${randomId("").slice(0, 10).toUpperCase()}`;
  return issueTickets(order.id, method, paymentRef);
}

export function markOrderPaidByReference(
  reference: string,
  provider: string,
  method: string,
  paymentRef: string,
  expectedAmountCents?: number,
) {
  const order = get<Order>("SELECT * FROM orders WHERE reference = ?", reference);
  if (!order) return { ok: false as const, error: "Order not found." };
  if (order.status === "paid") {
    return { ok: true as const, alreadyPaid: true, orderId: order.id };
  }
  if (order.status !== "pending") {
    return { ok: false as const, error: `Order is ${order.status}.` };
  }
  if (typeof expectedAmountCents === "number" && expectedAmountCents !== order.total_cents) {
    return { ok: false as const, error: "Paid amount does not match the order total." };
  }
  const result = issueTickets(order.id, method, paymentRef, provider);
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }
  return { ok: true as const, alreadyPaid: false, orderId: order.id };
}

export function getOrderForUser(orderId: string, userId: string) {
  return get<Order>(`${ORDER_SELECT} WHERE o.id = ? AND o.user_id = ?`, orderId, userId);
}

export function getOrderById(orderId: string) {
  return get<Order>(`${ORDER_SELECT} WHERE o.id = ?`, orderId);
}

export function getOrderItems(orderId: string): OrderItem[] {
  return all<OrderItem>(
    `SELECT oi.*, tt.name AS ticket_type_name, tt.description AS ticket_type_description, tt.perks
     FROM order_items oi
     JOIN ticket_types tt ON tt.id = oi.ticket_type_id
     WHERE oi.order_id = ?`,
    orderId,
  );
}

export function getTicketsForOrder(orderId: string): Ticket[] {
  return all<Ticket>(
    `SELECT t.*, tt.name AS ticket_type_name
     FROM tickets t JOIN ticket_types tt ON tt.id = t.ticket_type_id
     WHERE t.order_id = ? ORDER BY t.issued_at ASC`,
    orderId,
  );
}

export function listOrdersForUser(userId: string): Order[] {
  return all<Order>(
    `${ORDER_SELECT} WHERE o.user_id = ? ORDER BY o.created_at DESC`,
    userId,
  );
}

export function listRecentOrdersForAdmin(): Order[] {
  return all<Order>(
    `${ORDER_SELECT} WHERE o.status IN ('paid', 'pending', 'refunded') ORDER BY o.created_at DESC LIMIT 50`,
  );
}

export function getUserTickets(userId: string): Ticket[] {
  return all<Ticket>(
    `SELECT t.*, e.title AS event_title, e.slug AS event_slug, e.starts_at AS event_starts_at,
            e.ends_at AS event_ends_at, e.venue, e.city, e.cover_image,
            tt.name AS ticket_type_name, o.reference AS order_reference
     FROM tickets t
     JOIN events e ON e.id = t.event_id
     JOIN ticket_types tt ON tt.id = t.ticket_type_id
     JOIN orders o ON o.id = t.order_id
     WHERE o.user_id = ? AND o.status IN ('paid', 'partially_refunded')
     ORDER BY e.starts_at ASC, t.issued_at ASC`,
    userId,
  );
}

export interface TicketWithOrderState extends Ticket {
  order_status: OrderStatus;
}

export function listAllUserTickets(userId: string): TicketWithOrderState[] {
  return all<TicketWithOrderState>(
    `SELECT t.*, e.title AS event_title, e.slug AS event_slug, e.starts_at AS event_starts_at,
            e.ends_at AS event_ends_at, e.venue, e.city, e.cover_image,
            tt.name AS ticket_type_name, o.reference AS order_reference,
            o.status AS order_status
     FROM tickets t
     JOIN events e ON e.id = t.event_id
     JOIN ticket_types tt ON tt.id = t.ticket_type_id
     JOIN orders o ON o.id = t.order_id
     WHERE o.user_id = ? AND o.status IN ('paid', 'partially_refunded', 'refunded')
     ORDER BY e.starts_at ASC, t.issued_at ASC`,
    userId,
  );
}

export function getTicketById(ticketId: string): Ticket | undefined {
  return get<Ticket>(
    `SELECT t.*, e.title AS event_title, e.slug AS event_slug, e.starts_at AS event_starts_at,
            e.ends_at AS event_ends_at, e.venue, e.city, e.cover_image,
            tt.name AS ticket_type_name, o.reference AS order_reference
     FROM tickets t
     JOIN events e ON e.id = t.event_id
     JOIN ticket_types tt ON tt.id = t.ticket_type_id
     JOIN orders o ON o.id = t.order_id
     WHERE t.id = ?`,
    ticketId,
  );
}

export function getTicketForUser(ticketId: string, userId: string): Ticket | undefined {
  return get<Ticket>(
    `SELECT t.*, e.title AS event_title, e.slug AS event_slug, e.starts_at AS event_starts_at,
            e.ends_at AS event_ends_at, e.category AS event_category, e.venue, e.city, e.cover_image,
            tt.name AS ticket_type_name, o.reference AS order_reference
     FROM tickets t
     JOIN events e ON e.id = t.event_id
     JOIN ticket_types tt ON tt.id = t.ticket_type_id
     JOIN orders o ON o.id = t.order_id
     WHERE t.id = ? AND o.user_id = ?`,
    ticketId,
    userId,
  );
}

export function refundOrder(orderId: string) {
  return transaction((db) => {
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as unknown as
      | Order
      | undefined;
    if (!order) return { ok: false as const, error: "Order not found." };
    if (order.status !== "paid") {
      return { ok: false as const, error: "Only paid orders can be refunded." };
    }
    const items = db
      .prepare("SELECT ticket_type_id, quantity FROM order_items WHERE order_id = ?")
      .all(order.id) as { ticket_type_id: string; quantity: number }[];
    const used = db
      .prepare("SELECT COUNT(*) AS count FROM tickets WHERE order_id = ? AND status = 'used'")
      .get(order.id) as { count: number };
    if (Number(used.count) > 0) {
      return { ok: false as const, error: "This order contains tickets that were already scanned." };
    }
    db.prepare("UPDATE tickets SET status = 'void' WHERE order_id = ? AND status = 'valid'").run(
      order.id,
    );
    for (const item of items) {
      db.prepare("UPDATE ticket_types SET sold = MAX(0, sold - ?) WHERE id = ?").run(
        item.quantity,
        item.ticket_type_id,
      );
    }
    db.prepare(
      "UPDATE orders SET status = 'refunded', refunded_cents = total_cents WHERE id = ?",
    ).run(order.id);
    return { ok: true as const, refundedCents: order.total_cents };
  });
}
