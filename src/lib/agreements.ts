import "server-only";
import { all, get, run, transaction } from "./db";
import { writeAudit } from "./audit";
import { randomId } from "./format";
import type {
  AgreementTermsInput,
  ArtistAgreementVersion,
  ArtistAgreementWithContext,
  ArtistInvoice,
  ArtistPayment,
  PaymentMethod,
  User,
} from "./types";

const MAX_MONEY_CENTS = 10_000_000;
const MAX_TEXT = 2000;
const MAX_NOTE = 500;
const PAYMENT_METHODS: PaymentMethod[] = [
  "bank_transfer",
  "mobile_money",
  "cash",
  "card",
  "other",
];

type Result = { ok: true } | { ok: false; error: string };

const CONTEXT_SELECT = `
  SELECT a.*,
         b.status AS booking_status, b.event_id,
         e.title AS event_title, e.slug AS event_slug, e.starts_at AS event_starts_at,
         e.ends_at AS event_ends_at, e.venue AS event_venue, e.city AS event_city,
         e.status AS event_status,
         ap.stage_name AS artist_stage_name, ap.slug AS artist_slug,
         ou.name AS organizer_name, op.business_name AS organizer_business,
         ou.email AS organizer_email, ou.phone AS organizer_phone,
         cv.status AS current_status, cv.fee_cents AS current_fee_cents,
         cv.currency AS current_currency, cv.deposit_cents AS current_deposit_cents,
         cv.deposit_due_on AS current_deposit_due_on,
         cv.balance_due_on AS current_balance_due_on,
         cv.change_summary AS current_change_summary,
         cv.response_note AS current_response_note,
         cv.sent_at AS current_sent_at, cv.responded_at AS current_accepted_at,
         av.version AS accepted_version, av.fee_cents AS accepted_fee_cents,
         COALESCE((SELECT SUM(p.amount_cents) FROM artist_payments p
                   WHERE p.agreement_id = a.id AND p.status = 'received'), 0) AS payments_received_cents,
         COALESCE((SELECT SUM(p.amount_cents) FROM artist_payments p
                   WHERE p.agreement_id = a.id AND p.status = 'recorded'), 0) AS payments_recorded_cents,
         (SELECT COUNT(*) FROM artist_invoices i WHERE i.agreement_id = a.id) AS invoice_count
  FROM artist_agreements a
  JOIN artist_bookings b ON b.id = a.booking_id
  JOIN events e ON e.id = b.event_id
  JOIN artist_profiles ap ON ap.user_id = a.artist_id
  JOIN users ou ON ou.id = a.organizer_id
  LEFT JOIN organizer_profiles op ON op.user_id = a.organizer_id
  JOIN artist_agreement_versions cv
    ON cv.agreement_id = a.id AND cv.version = a.current_version
  LEFT JOIN artist_agreement_versions av
    ON av.agreement_id = a.id AND av.version = (
      SELECT MAX(v.version) FROM artist_agreement_versions v
      WHERE v.agreement_id = a.id AND v.status = 'accepted'
    )`;

const PAYMENT_SELECT = `
  SELECT p.*, i.number AS invoice_number, u.name AS recorder_name, e.title AS event_title
  FROM artist_payments p
  JOIN artist_agreements a ON a.id = p.agreement_id
  JOIN artist_bookings b ON b.id = a.booking_id
  JOIN events e ON e.id = b.event_id
  LEFT JOIN artist_invoices i ON i.id = p.invoice_id
  LEFT JOIN users u ON u.id = p.recorded_by`;

const INVOICE_SELECT = `
  SELECT i.*,
         COALESCE((SELECT SUM(p.amount_cents) FROM artist_payments p
                   WHERE p.invoice_id = i.id AND p.status = 'received'), 0) AS received_cents,
         COALESCE((SELECT SUM(p.amount_cents) FROM artist_payments p
                   WHERE p.invoice_id = i.id AND p.status = 'recorded'), 0) AS recorded_cents,
         e.title AS event_title, ou.name AS organizer_name,
         op.business_name AS organizer_business
  FROM artist_invoices i
  JOIN artist_agreements a ON a.id = i.agreement_id
  JOIN artist_bookings b ON b.id = a.booking_id
  JOIN events e ON e.id = b.event_id
  JOIN users ou ON ou.id = i.organizer_id
  LEFT JOIN organizer_profiles op ON op.user_id = i.organizer_id`;

export function harareTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Harare",
  }).format(new Date());
}

function validDateKey(value: string | undefined | null) {
  const raw = (value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === raw ? raw : null;
}

function parseMoney(value: unknown, label: string, allowBlank = false) {
  if (value === undefined || value === null || value === "") {
    return allowBlank
      ? ({ ok: true, cents: 0 } as const)
      : ({ ok: false, error: `Enter the ${label}.` } as const);
  }
  const raw = typeof value === "number" ? String(value) : String(value).trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw)) {
    return { ok: false, error: `Enter the ${label} like 1200 or 1200.50.` } as const;
  }
  const [whole, fraction = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (cents > MAX_MONEY_CENTS) {
    return { ok: false, error: `That ${label} is too high for this form.` } as const;
  }
  return { ok: true, cents } as const;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "";
}

function parseTerms(input: AgreementTermsInput) {
  const fee = parseMoney(input.fee, "agreed fee");
  if (!fee.ok) return fee;
  if (fee.cents <= 0) return { ok: false, error: "The agreed fee must be more than zero." } as const;

  const deposit = parseMoney(input.deposit, "deposit", true);
  if (!deposit.ok) return deposit;
  if (deposit.cents > fee.cents) {
    return { ok: false, error: "The deposit cannot be more than the agreed fee." } as const;
  }

  const depositDueOn = validDateKey(input.depositDueOn);
  if (deposit.cents > 0 && !depositDueOn) {
    return { ok: false, error: "Choose a valid date for the deposit." } as const;
  }
  if (input.depositDueOn && deposit.cents === 0) {
    return { ok: false, error: "Add a deposit amount before setting its due date." } as const;
  }

  const balanceDueOn = validDateKey(input.balanceDueOn);
  if (input.balanceDueOn && !balanceDueOn) {
    return { ok: false, error: "Choose a valid date for the balance." } as const;
  }
  if (deposit.cents > 0 && depositDueOn && balanceDueOn && depositDueOn > balanceDueOn) {
    return {
      ok: false,
      error: "The deposit date must be on or before the balance date.",
    } as const;
  }

  return {
    ok: true,
    terms: {
      feeCents: fee.cents,
      depositCents: deposit.cents,
      depositDueOn: deposit.cents > 0 ? depositDueOn : null,
      balanceDueOn,
      cancellationTerms: textValue(input.cancellationTerms) || null,
      transportArrangements: textValue(input.transportArrangements) || null,
      accommodationArrangements: textValue(input.accommodationArrangements) || null,
      technicalRequirements: textValue(input.technicalRequirements) || null,
      responsibilities: textValue(input.responsibilities) || null,
      additionalConditions: textValue(input.additionalConditions) || null,
      changeSummary: textValue(input.changeSummary) || null,
    },
  } as const;
}

function audit(
  actor: User,
  action: string,
  entityId: string,
  after: Record<string, unknown>,
  ip?: string | null,
  before?: Record<string, unknown>,
) {
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action,
    entityType: "artist_agreement",
    entityId,
    before,
    after,
    ip,
  });
}

function latestVersion(agreementId: string) {
  return get<ArtistAgreementVersion>(
    `SELECT * FROM artist_agreement_versions
     WHERE agreement_id = ? ORDER BY version DESC LIMIT 1`,
    agreementId,
  );
}

export function listArtistAgreements(artistId: string) {
  return all<ArtistAgreementWithContext>(
    `${CONTEXT_SELECT} WHERE a.artist_id = ? ORDER BY a.updated_at DESC`,
    artistId,
  );
}

export function listOrganizerAgreements(organizerId: string) {
  return all<ArtistAgreementWithContext>(
    `${CONTEXT_SELECT} WHERE a.organizer_id = ? ORDER BY a.updated_at DESC`,
    organizerId,
  );
}

export function getAgreementForArtist(id: string, artistId: string) {
  return get<ArtistAgreementWithContext>(
    `${CONTEXT_SELECT} WHERE a.id = ? AND a.artist_id = ?`,
    id,
    artistId,
  );
}

export function getAgreementForOrganizer(id: string, organizerId: string) {
  return get<ArtistAgreementWithContext>(
    `${CONTEXT_SELECT} WHERE a.id = ? AND a.organizer_id = ?`,
    id,
    organizerId,
  );
}

export function listAgreementVersions(agreementId: string) {
  return all<ArtistAgreementVersion>(
    `SELECT * FROM artist_agreement_versions
     WHERE agreement_id = ? ORDER BY version DESC`,
    agreementId,
  );
}

export function listAgreementPayments(agreementId: string) {
  return all<ArtistPayment>(
    `${PAYMENT_SELECT} WHERE p.agreement_id = ? ORDER BY p.paid_on DESC, p.created_at DESC`,
    agreementId,
  );
}

export function listArtistPayments(artistId: string) {
  return all<ArtistPayment>(
    `${PAYMENT_SELECT} WHERE p.artist_id = ? ORDER BY p.paid_on DESC, p.created_at DESC LIMIT 100`,
    artistId,
  );
}

export function listAgreementInvoices(agreementId: string) {
  return all<ArtistInvoice>(
    `${INVOICE_SELECT} WHERE i.agreement_id = ? ORDER BY i.issued_on DESC, i.created_at DESC`,
    agreementId,
  );
}

export function listArtistInvoices(artistId: string) {
  return all<ArtistInvoice>(
    `${INVOICE_SELECT} WHERE i.artist_id = ? ORDER BY i.issued_on DESC, i.created_at DESC LIMIT 100`,
    artistId,
  );
}

export function listAcceptedBookingsWithoutAgreement(organizerId: string) {
  return all<{
    id: string;
    artist_id: string;
    artist_stage_name: string;
    event_title: string;
    event_starts_at: string;
    proposed_fee_cents: number | null;
    currency: string;
  }>(
    `SELECT b.id, b.artist_id, ap.stage_name AS artist_stage_name, e.title AS event_title,
            e.starts_at AS event_starts_at, b.proposed_fee_cents, b.currency
     FROM artist_bookings b
     JOIN events e ON e.id = b.event_id
     JOIN artist_profiles ap ON ap.user_id = b.artist_id
     LEFT JOIN artist_agreements a ON a.booking_id = b.id
     WHERE b.organizer_id = ? AND b.status = 'accepted' AND a.id IS NULL
       AND e.status NOT IN ('cancelled', 'completed')
     ORDER BY e.starts_at ASC`,
    organizerId,
  );
}

export function createAgreement(
  input: { bookingId?: string } & AgreementTermsInput,
  organizer: User,
  ip?: string | null,
): { ok: true; agreementId: string } | { ok: false; error: string } {
  const bookingId = (input.bookingId || "").trim();
  if (!bookingId) return { ok: false, error: "Choose a confirmed booking." };

  const booking = get<{
    id: string;
    status: string;
    artist_id: string;
    event_id: string;
    event_title: string;
    event_status: string;
  }>(
    `SELECT b.id, b.status, b.artist_id, b.event_id, e.title AS event_title,
            e.status AS event_status
     FROM artist_bookings b JOIN events e ON e.id = b.event_id
     WHERE b.id = ? AND b.organizer_id = ?`,
    bookingId,
    organizer.id,
  );
  if (!booking) return { ok: false, error: "Confirmed booking not found." };
  if (booking.status !== "accepted") {
    return { ok: false, error: "Agreements can only be created for confirmed bookings." };
  }
  if (["cancelled", "completed"].includes(booking.event_status)) {
    return { ok: false, error: "That event is no longer open for agreements." };
  }

  const existing = get<{ id: string }>(
    "SELECT id FROM artist_agreements WHERE booking_id = ?",
    bookingId,
  );
  if (existing) return { ok: false, error: "An agreement already exists for this booking." };

  const parsed = parseTerms(input);
  if (!parsed.ok) return parsed;
  const terms = parsed.terms;

  const id = randomId("agr_");
  const versionId = randomId("agv_");
  const now = new Date().toISOString();
  transaction((db) => {
    db.prepare(
      `INSERT INTO artist_agreements
         (id, booking_id, artist_id, organizer_id, status, current_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', 1, ?, ?)`,
    ).run(id, booking.id, booking.artist_id, organizer.id, now, now);
    db.prepare(
      `INSERT INTO artist_agreement_versions
         (id, agreement_id, version, status, fee_cents, currency, deposit_cents, deposit_due_on,
          balance_due_on, cancellation_terms, transport_arrangements, accommodation_arrangements,
          technical_requirements, responsibilities, additional_conditions, change_summary,
          response_note, created_by, created_at, sent_at, responded_at)
       VALUES (?, ?, 1, 'draft', ?, 'USD', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL, NULL)`,
    ).run(
      versionId,
      id,
      terms.feeCents,
      terms.depositCents,
      terms.depositDueOn,
      terms.balanceDueOn,
      terms.cancellationTerms,
      terms.transportArrangements,
      terms.accommodationArrangements,
      terms.technicalRequirements,
      terms.responsibilities,
      terms.additionalConditions,
      organizer.id,
      now,
    );
  });

  audit(
    organizer,
    "agreement.created",
    id,
    {
      bookingId: booking.id,
      artistId: booking.artist_id,
      eventTitle: booking.event_title,
      feeCents: terms.feeCents,
      depositCents: terms.depositCents,
    },
    ip,
  );
  return { ok: true, agreementId: id };
}

export function saveAgreement(
  agreementId: string,
  organizer: User,
  input: AgreementTermsInput,
  ip?: string | null,
): Result {
  const agreement = getAgreementForOrganizer(agreementId, organizer.id);
  if (!agreement) return { ok: false, error: "Agreement not found." };
  if (agreement.event_status === "cancelled") {
    return { ok: false, error: "This event has been cancelled." };
  }

  const latest = latestVersion(agreementId);
  if (!latest) return { ok: false, error: "Agreement version not found." };
  if (latest.status === "sent") {
    return {
      ok: false,
      error: "This version is with the artist. Wait for their response before changing it.",
    };
  }

  const isAmendment = latest.status === "accepted";
  const parsed = parseTerms(input);
  if (!parsed.ok) return parsed;
  if (isAmendment && !parsed.terms.changeSummary) {
    return { ok: false, error: "Summarise what changed so the artist can review it." };
  }
  const terms = parsed.terms;
  const now = new Date().toISOString();
  const before = {
    version: latest.version,
    status: latest.status,
    feeCents: latest.fee_cents,
  };

  transaction((db) => {
    if (latest.status === "draft") {
      db.prepare(
        `UPDATE artist_agreement_versions SET
           fee_cents = ?, deposit_cents = ?, deposit_due_on = ?, balance_due_on = ?,
           cancellation_terms = ?, transport_arrangements = ?, accommodation_arrangements = ?,
           technical_requirements = ?, responsibilities = ?, additional_conditions = ?,
           change_summary = ?
         WHERE id = ?`,
      ).run(
        terms.feeCents,
        terms.depositCents,
        terms.depositDueOn,
        terms.balanceDueOn,
        terms.cancellationTerms,
        terms.transportArrangements,
        terms.accommodationArrangements,
        terms.technicalRequirements,
        terms.responsibilities,
        terms.additionalConditions,
        terms.changeSummary,
        latest.id,
      );
      db.prepare(
        "UPDATE artist_agreements SET status = 'draft', updated_at = ? WHERE id = ?",
      ).run(now, agreementId);
    } else {
      const nextVersion = latest.version + 1;
      db.prepare(
        `INSERT INTO artist_agreement_versions
           (id, agreement_id, version, status, fee_cents, currency, deposit_cents, deposit_due_on,
            balance_due_on, cancellation_terms, transport_arrangements, accommodation_arrangements,
            technical_requirements, responsibilities, additional_conditions, change_summary,
            response_note, created_by, created_at, sent_at, responded_at)
         VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL)`,
      ).run(
        randomId("agv_"),
        agreementId,
        nextVersion,
        terms.feeCents,
        "USD",
        terms.depositCents,
        terms.depositDueOn,
        terms.balanceDueOn,
        terms.cancellationTerms,
        terms.transportArrangements,
        terms.accommodationArrangements,
        terms.technicalRequirements,
        terms.responsibilities,
        terms.additionalConditions,
        terms.changeSummary,
        organizer.id,
        now,
      );
      db.prepare(
        `UPDATE artist_agreements
         SET current_version = ?, status = 'draft', updated_at = ? WHERE id = ?`,
      ).run(nextVersion, now, agreementId);
    }
  });

  audit(
    organizer,
    isAmendment ? "agreement.amendment_saved" : "agreement.saved",
    agreementId,
    { status: "draft", feeCents: terms.feeCents, version: isAmendment ? latest.version + 1 : latest.version },
    ip,
    before,
  );
  return { ok: true };
}

export function sendAgreement(
  agreementId: string,
  organizer: User,
  ip?: string | null,
): Result {
  const agreement = getAgreementForOrganizer(agreementId, organizer.id);
  if (!agreement) return { ok: false, error: "Agreement not found." };
  if (agreement.event_status === "cancelled") {
    return { ok: false, error: "This event has been cancelled." };
  }
  const latest = latestVersion(agreementId);
  if (!latest) return { ok: false, error: "Agreement version not found." };
  if (latest.status !== "draft") {
    return { ok: false, error: "Only a draft can be sent to the artist." };
  }
  if (latest.fee_cents <= 0) {
    return { ok: false, error: "Add an agreed fee before sending." };
  }

  const now = new Date().toISOString();
  transaction((db) => {
    db.prepare(
      `UPDATE artist_agreement_versions SET status = 'sent', sent_at = ?
       WHERE id = ? AND status = 'draft'`,
    ).run(now, latest.id);
    db.prepare(
      "UPDATE artist_agreements SET status = 'sent', updated_at = ? WHERE id = ?",
    ).run(now, agreementId);
  });
  audit(
    organizer,
    "agreement.sent",
    agreementId,
    { version: latest.version, feeCents: latest.fee_cents },
    ip,
    { status: latest.status },
  );
  return { ok: true };
}

export function acceptAgreement(
  agreementId: string,
  artist: User,
  ip?: string | null,
): Result {
  const agreement = getAgreementForArtist(agreementId, artist.id);
  if (!agreement) return { ok: false, error: "Agreement not found." };
  if (agreement.booking_status !== "accepted") {
    return { ok: false, error: "This booking is no longer confirmed." };
  }
  if (["cancelled", "completed"].includes(agreement.event_status)) {
    return { ok: false, error: "The event is closed." };
  }
  const latest = latestVersion(agreementId);
  if (!latest || latest.status !== "sent") {
    return { ok: false, error: "This agreement is not awaiting your acceptance." };
  }

  const now = new Date().toISOString();
  transaction((db) => {
    db.prepare(
      `UPDATE artist_agreement_versions SET status = 'superseded'
       WHERE agreement_id = ? AND id != ? AND status != 'superseded'`,
    ).run(agreementId, latest.id);
    db.prepare(
      `UPDATE artist_agreement_versions
       SET status = 'accepted', responded_at = ?
       WHERE id = ? AND status = 'sent'`,
    ).run(now, latest.id);
    db.prepare(
      "UPDATE artist_agreements SET status = 'accepted', updated_at = ? WHERE id = ?",
    ).run(now, agreementId);
  });

  audit(
    artist,
    "agreement.accepted",
    agreementId,
    { version: latest.version, feeCents: latest.fee_cents, organizerId: agreement.organizer_id },
    ip,
    { status: "sent" },
  );
  return { ok: true };
}

export function requestAgreementChanges(
  agreementId: string,
  artist: User,
  note: string | undefined,
  ip?: string | null,
): Result {
  const text = (note || "").trim().slice(0, MAX_NOTE);
  if (text.length < 3) {
    return { ok: false, error: "Explain what needs to change so the organizer can update it." };
  }
  const agreement = getAgreementForArtist(agreementId, artist.id);
  if (!agreement) return { ok: false, error: "Agreement not found." };
  const latest = latestVersion(agreementId);
  if (!latest || latest.status !== "sent") {
    return { ok: false, error: "This agreement is not awaiting your response." };
  }

  const now = new Date().toISOString();
  transaction((db) => {
    db.prepare(
      `UPDATE artist_agreement_versions
       SET status = 'changes_requested', response_note = ?, responded_at = ?
       WHERE id = ? AND status = 'sent'`,
    ).run(text, now, latest.id);
    db.prepare(
      "UPDATE artist_agreements SET status = 'changes_requested', updated_at = ? WHERE id = ?",
    ).run(now, agreementId);
  });

  audit(
    artist,
    "agreement.changes_requested",
    agreementId,
    { version: latest.version, note: text },
    ip,
    { status: "sent" },
  );
  return { ok: true };
}

export function recordPayment(
  input: {
    agreementId?: string;
    amount?: unknown;
    paidOn?: string;
    method?: string;
    reference?: string;
    note?: string;
    invoiceId?: string;
  },
  organizer: User,
  ip?: string | null,
): { ok: true; paymentId: string } | { ok: false; error: string } {
  const agreementId = (input.agreementId || "").trim();
  if (!agreementId) return { ok: false, error: "Choose an agreement." };
  const agreement = getAgreementForOrganizer(agreementId, organizer.id);
  if (!agreement) return { ok: false, error: "Agreement not found." };
  if (agreement.accepted_fee_cents === null) {
    return { ok: false, error: "The artist must accept the agreement before payments are recorded." };
  }
  if (agreement.booking_status === "cancelled") {
    return { ok: false, error: "This booking has been cancelled." };
  }

  const amount = parseMoney(input.amount, "payment amount");
  if (!amount.ok) return amount;
  if (amount.cents <= 0) return { ok: false, error: "The payment amount must be more than zero." };

  const paidOn = validDateKey(input.paidOn);
  if (!paidOn) return { ok: false, error: "Choose a valid date the payment was made." };
  if (paidOn > harareTodayKey()) {
    return { ok: false, error: "Payments cannot be recorded for a future date." };
  }

  const method = PAYMENT_METHODS.includes(input.method as PaymentMethod)
    ? (input.method as PaymentMethod)
    : null;
  if (!method) return { ok: false, error: "Choose how the payment was made." };

  const reference = (input.reference || "").trim().slice(0, 100);
  const note = (input.note || "").trim().slice(0, 300);

  const totals = get<{ received: number; recorded: number }>(
    `SELECT COALESCE(SUM(CASE WHEN status = 'received' THEN amount_cents ELSE 0 END), 0) AS received,
            COALESCE(SUM(CASE WHEN status = 'recorded' THEN amount_cents ELSE 0 END), 0) AS recorded
     FROM artist_payments WHERE agreement_id = ?`,
    agreementId,
  );
  const already = Number(totals?.received || 0) + Number(totals?.recorded || 0);
  if (already + amount.cents > agreement.accepted_fee_cents) {
    return {
      ok: false,
      error: "That would record more than the agreed fee. Check the amount or correct the agreement.",
    };
  }

  let invoiceId: string | null = null;
  if (input.invoiceId) {
    const invoice = get<{ id: string; amount_cents: number; status: string }>(
      "SELECT id, amount_cents, status FROM artist_invoices WHERE id = ? AND agreement_id = ?",
      input.invoiceId,
      agreementId,
    );
    if (!invoice || invoice.status !== "issued") {
      return { ok: false, error: "That invoice is not open for payments." };
    }
    const invoiceTotals = get<{
      received: number;
      recorded: number;
    }>(
      `SELECT COALESCE(SUM(CASE WHEN status = 'received' THEN amount_cents ELSE 0 END), 0) AS received,
              COALESCE(SUM(CASE WHEN status = 'recorded' THEN amount_cents ELSE 0 END), 0) AS recorded
       FROM artist_payments WHERE invoice_id = ?`,
      invoice.id,
    );
    const paid = Number(invoiceTotals?.received || 0) + Number(invoiceTotals?.recorded || 0);
    if (paid + amount.cents > invoice.amount_cents) {
      return { ok: false, error: "That payment is more than the invoice balance." };
    }
    invoiceId = invoice.id;
  }

  if (reference) {
    const duplicate = get<{ id: string }>(
      `SELECT id FROM artist_payments
       WHERE agreement_id = ? AND reference = ? AND amount_cents = ? AND paid_on = ?
         AND status != 'failed'`,
      agreementId,
      reference,
      amount.cents,
      paidOn,
    );
    if (duplicate) {
      return { ok: false, error: "A payment with that reference and amount is already recorded." };
    }
  }

  const id = randomId("pay_");
  const now = new Date().toISOString();
  run(
    `INSERT INTO artist_payments
       (id, agreement_id, invoice_id, artist_id, organizer_id, amount_cents, currency, status,
        method, reference, note, paid_on, recorded_by, recorded_at, confirmed_by, confirmed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'USD', 'recorded', ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
    id,
    agreementId,
    invoiceId,
    agreement.artist_id,
    organizer.id,
    amount.cents,
    method,
    reference || null,
    note || null,
    paidOn,
    organizer.id,
    now,
    now,
  );

  audit(
    organizer,
    "payment.recorded",
    agreementId,
    {
      paymentId: id,
      amountCents: amount.cents,
      paidOn,
      method,
      reference: reference || null,
      invoiceId,
    },
    ip,
  );
  return { ok: true, paymentId: id };
}

export function confirmPayment(
  paymentId: string,
  artist: User,
  ip?: string | null,
): Result {
  const payment = get<ArtistPayment>(
    "SELECT * FROM artist_payments WHERE id = ? AND artist_id = ?",
    paymentId,
    artist.id,
  );
  if (!payment) return { ok: false, error: "Payment not found." };
  if (payment.status !== "recorded") {
    return { ok: false, error: "This payment is not awaiting your confirmation." };
  }

  const now = new Date().toISOString();
  const result = run(
    `UPDATE artist_payments
     SET status = 'received', confirmed_by = ?, confirmed_at = ?
     WHERE id = ? AND artist_id = ? AND status = 'recorded'`,
    artist.id,
    now,
    paymentId,
    artist.id,
  );
  if (Number(result.changes) === 0) {
    return { ok: false, error: "This payment changed while you were confirming it. Reload and try again." };
  }

  audit(
    artist,
    "payment.confirmed",
    payment.agreement_id,
    { paymentId, amountCents: payment.amount_cents },
    ip,
    { status: "recorded" },
  );
  return { ok: true };
}

export function markPaymentFailed(
  paymentId: string,
  organizer: User,
  ip?: string | null,
): Result {
  const payment = get<ArtistPayment>(
    "SELECT * FROM artist_payments WHERE id = ? AND organizer_id = ?",
    paymentId,
    organizer.id,
  );
  if (!payment) return { ok: false, error: "Payment not found." };
  if (payment.status !== "recorded") {
    return { ok: false, error: "Only a payment awaiting confirmation can be marked as failed." };
  }

  run(
    "UPDATE artist_payments SET status = 'failed' WHERE id = ? AND status = 'recorded'",
    paymentId,
  );
  audit(
    organizer,
    "payment.failed",
    payment.agreement_id,
    { paymentId, amountCents: payment.amount_cents },
    ip,
    { status: "recorded" },
  );
  return { ok: true };
}

export function createInvoice(
  input: { agreementId?: string; amount?: unknown; description?: string; dueOn?: string },
  artist: User,
  ip?: string | null,
): { ok: true; invoiceId: string; number: string } | { ok: false; error: string } {
  const agreementId = (input.agreementId || "").trim();
  if (!agreementId) return { ok: false, error: "Choose an agreement." };
  const agreement = getAgreementForArtist(agreementId, artist.id);
  if (!agreement) return { ok: false, error: "Agreement not found." };
  if (agreement.accepted_fee_cents === null) {
    return { ok: false, error: "The agreement must be accepted before you can invoice." };
  }
  if (agreement.booking_status === "cancelled") {
    return { ok: false, error: "This booking has been cancelled." };
  }

  const amount = parseMoney(input.amount, "invoice amount");
  if (!amount.ok) return amount;
  if (amount.cents <= 0) return { ok: false, error: "The invoice amount must be more than zero." };
  if (amount.cents > agreement.accepted_fee_cents) {
    return { ok: false, error: "An invoice cannot be more than the agreed fee." };
  }
  const invoiced = get<{ total: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM artist_invoices
     WHERE agreement_id = ? AND status != 'void'`,
    agreementId,
  );
  if (Number(invoiced?.total || 0) + amount.cents > agreement.accepted_fee_cents) {
    return { ok: false, error: "Open invoices already cover the agreed fee. Void one first." };
  }

  const description = (input.description || "").trim().slice(0, 300);
  if (description.length < 3) {
    return { ok: false, error: "Describe what the invoice covers." };
  }

  const issuedOn = harareTodayKey();
  const dueOn = validDateKey(input.dueOn);
  if (!dueOn) return { ok: false, error: "Choose a valid payment due date." };
  if (dueOn < issuedOn) return { ok: false, error: "The due date cannot be before today." };

  const year = issuedOn.slice(0, 4);
  const prefix = `INV-${year}-`;
  const rows = all<{ number: string }>(
    "SELECT number FROM artist_invoices WHERE number LIKE ?",
    `${prefix}%`,
  );
  let sequence = 0;
  for (const row of rows) {
    const value = Number(row.number.slice(prefix.length));
    if (Number.isInteger(value)) sequence = Math.max(sequence, value);
  }

  const id = randomId("inv_");
  const now = new Date().toISOString();
  let number = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    number = `${prefix}${String(sequence + attempt + 1).padStart(4, "0")}`;
    try {
      run(
        `INSERT INTO artist_invoices
           (id, agreement_id, artist_id, organizer_id, number, description, amount_cents, currency,
            status, issued_on, due_on, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'USD', 'issued', ?, ?, ?, ?)`,
        id,
        agreementId,
        artist.id,
        agreement.organizer_id,
        number,
        description,
        amount.cents,
        issuedOn,
        dueOn,
        artist.id,
        now,
      );
      break;
    } catch (error) {
      if (attempt === 4) {
        console.error("Invoice number allocation failed", error);
        return { ok: false, error: "Could not allocate an invoice number. Try again." };
      }
    }
  }

  audit(
    artist,
    "invoice.created",
    agreementId,
    { invoiceId: id, number, amountCents: amount.cents, dueOn },
    ip,
  );
  return { ok: true, invoiceId: id, number };
}

export function voidInvoice(
  invoiceId: string,
  artist: User,
  ip?: string | null,
): Result {
  const invoice = get<{ id: string; agreement_id: string; status: string }>(
    "SELECT id, agreement_id, status FROM artist_invoices WHERE id = ? AND artist_id = ?",
    invoiceId,
    artist.id,
  );
  if (!invoice) return { ok: false, error: "Invoice not found." };
  if (invoice.status !== "issued") return { ok: false, error: "This invoice is already void." };
  const payments = get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM artist_payments WHERE invoice_id = ? AND status != 'failed'",
    invoiceId,
  );
  if (Number(payments?.count || 0) > 0) {
    return { ok: false, error: "An invoice with recorded payments cannot be voided." };
  }

  run("UPDATE artist_invoices SET status = 'void' WHERE id = ? AND status = 'issued'", invoiceId);
  audit(
    artist,
    "invoice.voided",
    invoice.agreement_id,
    { invoiceId },
    ip,
    { status: "issued" },
  );
  return { ok: true };
}

export interface EarningsSummary {
  currency: string;
  agreementCount: number;
  contractedCents: number;
  receivedCents: number;
  recordedCents: number;
  outstandingCents: number;
  overpaidCents: number;
  overdueCents: number;
  upcomingCents: number;
  invoiceCount: number;
  completedPerformances: number;
  cancelledEngagements: number;
  cancelledReceivedCents: number;
}

export function earningsSummary(artistId: string): EarningsSummary {
  const agreements = listArtistAgreements(artistId);
  const today = harareTodayKey();

  let contracted = 0;
  let received = 0;
  let recorded = 0;
  let outstanding = 0;
  let overpaid = 0;
  let cancelledCount = 0;
  let cancelledReceived = 0;

  for (const agreement of agreements) {
    const receivedForAgreement = Number(agreement.payments_received_cents || 0);
    received += receivedForAgreement;
    recorded += Number(agreement.payments_recorded_cents || 0);

    if (agreement.booking_status === "cancelled") {
      cancelledCount += 1;
      cancelledReceived += receivedForAgreement;
      continue;
    }
    const fee = agreement.accepted_fee_cents;
    if (fee === null) continue;
    contracted += fee;
    if (fee >= receivedForAgreement) {
      outstanding += fee - receivedForAgreement;
    } else {
      overpaid += receivedForAgreement - fee;
    }
  }

  const invoices = listArtistInvoices(artistId);
  let overdue = 0;
  let upcoming = 0;
  let openInvoices = 0;
  for (const invoice of invoices) {
    if (invoice.status === "void") continue;
    openInvoices += 1;
    const balance = invoice.amount_cents - Number(invoice.received_cents || 0);
    if (balance <= 0) continue;
    if (invoice.due_on < today) overdue += balance;
    else upcoming += balance;
  }

  const completed = get<{ count: number }>(
    `SELECT COUNT(*) AS count FROM artist_bookings b
     JOIN events e ON e.id = b.event_id
     WHERE b.artist_id = ? AND b.status = 'accepted'
       AND COALESCE(e.ends_at, e.starts_at) < ?`,
    artistId,
    new Date().toISOString(),
  );

  return {
    currency: "USD",
    agreementCount: agreements.length,
    contractedCents: contracted,
    receivedCents: received,
    recordedCents: recorded,
    outstandingCents: outstanding,
    overpaidCents: overpaid,
    overdueCents: overdue,
    upcomingCents: upcoming,
    invoiceCount: openInvoices,
    completedPerformances: Number(completed?.count || 0),
    cancelledEngagements: cancelledCount,
    cancelledReceivedCents: cancelledReceived,
  };
}

export function invoiceBalanceStatus(invoice: ArtistInvoice, today = harareTodayKey()) {
  if (invoice.status === "void") return "void" as const;
  const balance = invoice.amount_cents - Number(invoice.received_cents || 0);
  if (balance <= 0) return "paid" as const;
  if (invoice.due_on < today) return "overdue" as const;
  if (Number(invoice.received_cents || 0) > 0) return "partial" as const;
  return "unpaid" as const;
}

export function listCancelledEngagements(artistId: string) {
  return all<{
    booking_id: string;
    event_title: string;
    event_starts_at: string;
    response_note: string | null;
    accepted_fee_cents: number | null;
    received_cents: number;
  }>(
    `SELECT b.id AS booking_id, e.title AS event_title, e.starts_at AS event_starts_at,
            b.response_note,
            (SELECT v.fee_cents FROM artist_agreement_versions v
             WHERE v.agreement_id = a.id AND v.status = 'accepted'
             ORDER BY v.version DESC LIMIT 1) AS accepted_fee_cents,
            COALESCE((SELECT SUM(p.amount_cents) FROM artist_payments p
                      WHERE p.agreement_id = a.id AND p.status = 'received'), 0) AS received_cents
     FROM artist_bookings b
     JOIN events e ON e.id = b.event_id
     LEFT JOIN artist_agreements a ON a.booking_id = b.id
     WHERE b.artist_id = ? AND b.status = 'cancelled'
     ORDER BY e.starts_at DESC`,
    artistId,
  );
}
