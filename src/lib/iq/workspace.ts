import "server-only";
import { getOrganizerProfile } from "@/lib/admin";
import { ARTIST_CATEGORIES, ARTIST_GENRES, ARTIST_REGIONS } from "@/lib/artist-options";
import { getArtistProfile, listPublicArtists, parseGenres, profileGaps } from "@/lib/artists";
import {
  bookingCounts,
  listArtistAvailability,
  listArtistBookings,
  listOrganizerBookings,
} from "@/lib/bookings";
import {
  earningsSummary,
  listAcceptedBookingsWithoutAgreement,
  listArtistAgreements,
  listOrganizerAgreements,
} from "@/lib/agreements";
import { listOrganizerEvents } from "@/lib/events";
import { getOrganizerEventBreakdown, getOrganizerStats } from "@/lib/stats";
import { formatDate, formatMoney, formatTimeRange } from "@/lib/format";
import { interpretQuestion } from "./discovery";
import { classifyWorkspaceIntent, type WorkspaceIntent, type WorkspaceSurface } from "./intent";
import type { ArtistBookingWithEvent, User } from "@/lib/types";

export interface WorkspaceResult {
  intent: WorkspaceIntent;
  surface: WorkspaceSurface;
  /** Deterministic reply used by the mock provider and as the fallback voice. */
  reply: string;
  /** Verified records the reply draws on; empty means it is guidance only. */
  records: string[];
  grounded: boolean;
}

const MAX_LINES = 6;
const AVAILABILITY_DAYS = 45;

function lines(items: string[]) {
  return items.join("\n");
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function statusSummary(counts: Record<string, number>) {
  const entries = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "none recorded";
  return entries.map(([status, count]) => `${statusLabel(status)}: ${count}`).join(" · ");
}

function feeRange(cents: number[]) {
  if (!cents.length) return null;
  return cents.length === 1
    ? formatMoney(cents[0])
    : `${formatMoney(Math.min(...cents))}–${formatMoney(Math.max(...cents))}`;
}

function pendingFees(bookings: ArtistBookingWithEvent[]) {
  return bookings
    .map((booking) => booking.proposed_fee_cents)
    .filter((cents): cents is number => typeof cents === "number");
}

function matchesArtistName(message: string, stageName: string) {
  const normalized = message.toLowerCase();
  const name = stageName.trim().toLowerCase();
  if (name.length < 3) return false;
  const pattern = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${pattern}([^a-z0-9]|$)`).test(normalized);
}

function findArtistInMessage(message: string) {
  return listPublicArtists({})
    .filter((artist) => matchesArtistName(message, artist.stage_name))
    .sort((a, b) => b.stage_name.length - a.stage_name.length)[0];
}

function searchTerms(message: string) {
  const lower = message.toLowerCase();
  const city = ARTIST_REGIONS.find((region) => lower.includes(region.toLowerCase()));
  const category = ARTIST_CATEGORIES.find((choice) => lower.includes(choice.toLowerCase()));
  const genre = ARTIST_GENRES.find((choice) => lower.includes(choice.toLowerCase()));
  const stopped = new Set([
    "find", "search", "looking", "look", "for", "artist", "artists", "musician", "musicians",
    "band", "bands", "dj", "djs", "comedian", "comedians", "performer", "performers", "talent",
    "who", "is", "are", "the", "a", "an", "in", "near", "based", "from", "available", "free",
    "on", "my", "event", "events", "me", "some", "any", "please", "recommend", "suggest",
    "good", "best", "with", "and", "can", "you", "show", "list", "that", "this", "here", "there",
    ...(city ? city.toLowerCase().split(/\s+/) : []),
    ...(category ? category.toLowerCase().split(/[\s/]+/) : []),
    ...(genre ? genre.toLowerCase().split(/\s+/) : []),
  ]);
  const keyword = lower
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !stopped.has(token))
    .sort((a, b) => b.length - a.length)[0];
  return { city, category, genre, keyword };
}

function publishedLine(artist: ReturnType<typeof listPublicArtists>[number]) {
  const genres = parseGenres(artist);
  return [
    artist.stage_name,
    artist.category,
    artist.city || "city not set",
    artist.verification_status === "verified" ? "verified" : statusLabel(artist.verification_status),
    artist.accepting_bookings ? "accepting requests" : "not accepting requests",
    genres.length ? genres.slice(0, 3).join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function bookingLine(booking: ArtistBookingWithEvent, perspective: "organizer" | "artist") {
  const other = perspective === "artist"
    ? booking.organizer_business || booking.organizer_name
    : booking.artist_stage_name;
  const state = booking.status === "requested" ? "awaiting reply" : statusLabel(booking.status);
  return `${booking.event_title} — ${formatDate(booking.event_starts_at)} · ${booking.event_venue} · ${state} · ${other}`;
}

function upcoming(bookings: ArtistBookingWithEvent[], statuses: string[]) {
  const now = Date.now();
  return bookings
    .filter((booking) => statuses.includes(booking.status))
    .filter((booking) => new Date(booking.event_starts_at).getTime() >= now)
    .sort(
      (a, b) =>
        new Date(a.event_starts_at).getTime() - new Date(b.event_starts_at).getTime(),
    );
}

function readOnlyNote() {
  return "IQ is read-only in this preview: I can't create, publish, send, book, confirm, pay, refund or change anything, and I won't claim an action happened.";
}

function organizerResult(user: User, message: string, intent: WorkspaceIntent): WorkspaceResult {
  const base = { surface: "organizer" as const, intent };
  const profile = getOrganizerProfile(user.id);

  if (!profile) {
    return {
      ...base,
      reply: `I can't find an organizer profile for this account, so there are no organizer records to read. You can start an application at /organizer/apply; once it's approved I can summarise your events and sales. ${readOnlyNote()}`,
      records: [],
      grounded: false,
    };
  }

  if (profile.status !== "approved") {
    return {
      ...base,
      reply: `Your organizer application for ${profile.business_name} is ${statusLabel(profile.status)}. IQ organizer tools read live records, so they unlock after approval. ${readOnlyNote()}`,
      records: [`organizer profile ${profile.business_name} · status ${statusLabel(profile.status)}`],
      grounded: true,
    };
  }

  if (intent === "greeting") {
    return {
      ...base,
      reply: `Hi! I'm IQ, your organizer assistant for ${profile.business_name}. Ask me about ticket sales, your events, artist requests, agreements or the published artist directory. ${readOnlyNote()}`,
      records: [],
      grounded: false,
    };
  }

  if (intent === "capability") {
    return {
      ...base,
      reply: `I read your own EventIQ records: ticket sales, event status, artist requests, agreements and the published artist directory. I can't see other organizers' data, artist private calendars or fee ranges that aren't recorded. ${readOnlyNote()}`,
      records: [],
      grounded: false,
    };
  }

  if (intent === "write_action") {
    return {
      ...base,
      reply: `I can't do that in this preview. To act, use the console: Events to publish or edit, Artists to send a request, Agreements to manage contracts, Reports to export data. ${readOnlyNote()}`,
      records: [],
      grounded: false,
    };
  }

  if (intent === "other_accounts") {
    return {
      ...base,
      reply: `I can only read records for ${profile.business_name}. I can't show another organizer's sales or bookings, or an artist's private calendar, blocks or other enquiries. ${readOnlyNote()}`,
      records: [],
      grounded: false,
    };
  }

  if (intent === "sales") {
    const stats = getOrganizerStats(user.id);
    const top = [...getOrganizerEventBreakdown(user.id)]
      .filter((row) => row.gross > 0)
      .sort((a, b) => b.gross - a.gross)
      .slice(0, 3);
    const records = [
      `gross ticket sales ${formatMoney(stats.grossCents)} from ${plural(stats.ordersCount, "paid order")}`,
      `net payout after commission and refunds ${formatMoney(stats.netToOrganizerCents)}`,
      `tickets sold ${stats.ticketsSold} · admitted ${stats.admitted}`,
      `refunded ${formatMoney(stats.refundedCents)}`,
      ...top.map((row) => `${row.title}: ${formatMoney(row.gross)} from ${row.tickets} tickets`),
    ];
    return {
      ...base,
      reply: `${
        stats.ordersCount
          ? "Here is your recorded sales picture:"
          : "No paid orders are recorded yet. Your current totals are:"
      }\n\n${lines(records.map((line) => `• ${line}`))}\n\nThese come from paid orders and issued tickets only. IQ can't change prices, refunds or payouts.`,
      records,
      grounded: true,
    };
  }

  if (intent === "fees") {
    const fees = pendingFees(listOrganizerBookings(user.id));
    const range = feeRange(fees);
    const records = range
      ? [`proposed fees on ${plural(fees.length, "booking request")}: ${range} (discussion points)`]
      : [];
    return {
      ...base,
      reply: `EventIQ doesn't store approved artist fee ranges, quotes or market benchmarks for organizers, so I can't suggest a rate as if it were platform data. ${
        records.length
          ? `What is recorded: ${records[0]}. A proposed fee is a conversation starter, not a quote or commitment.`
          : "No proposed fees are recorded on your booking requests either."
      } ${readOnlyNote()}`,
      records,
      grounded: records.length > 0,
    };
  }

  if (intent === "events") {
    const events = listOrganizerEvents(user.id);
    if (!events.length) {
      return {
        ...base,
        reply: `You haven't created any events yet. Use the Events page to draft one; once it exists I can summarise its status here. ${readOnlyNote()}`,
        records: [],
        grounded: false,
      };
    }
    const now = Date.now();
    const next = events
      .filter(
        (event) => new Date(event.starts_at).getTime() >= now && event.status !== "cancelled",
      )
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      .slice(0, MAX_LINES);
    const counts = events.reduce<Record<string, number>>((acc, event) => {
      acc[event.status] = (acc[event.status] || 0) + 1;
      return acc;
    }, {});
    const records = next.map(
      (event) =>
        `${event.title} — ${formatDate(event.starts_at)} · ${event.venue}, ${event.city} · ${statusLabel(event.status)}`,
    );
    return {
      ...base,
      reply: `You have ${plural(events.length, "event")} (${statusSummary(counts)}).${
        records.length
          ? `\n\nNext up:\n${lines(records.map((line) => `• ${line}`))}`
          : "\n\nNothing upcoming is recorded."
      }\n\nDates and statuses come from your event records. Publishing still happens in the Events console.`,
      records,
      grounded: true,
    };
  }

  if (intent === "artist_search") {
    const matched = findArtistInMessage(message);
    const terms = searchTerms(message);
    const results = matched
      ? [matched]
      : listPublicArtists({
          query: terms.keyword,
          category: terms.category,
          city: terms.city,
        }).slice(0, MAX_LINES);
    const records = results.map(publishedLine);

    if (!results.length) {
      return {
        ...base,
        reply: `No published artists match that search in the directory right now. I only search published, active profiles; I won't invent artists. Try a different city or act, or browse the Artists page. ${readOnlyNote()}`,
        records: [],
        grounded: false,
      };
    }

    const scope = terms.keyword || terms.category || terms.city;
    return {
      ...base,
      reply: `${matched ? `“${matched.stage_name}” is listed in the directory:` : scope ? `Published artists matching “${scope}”:` : "Here are some published artists:"}\n\n${lines(records.map((line) => `• ${line}`))}\n\nI can't see their private calendars, rates or other organizers' enquiries. Open the Artists page to send a request yourself — IQ can't send it.`,
      records,
      grounded: true,
    };
  }

  if (intent === "availability") {
    const artist = findArtistInMessage(message);
    if (!artist) {
      return {
        ...base,
        reply: `Tell me the artist's stage name. I can only check artists listed in the published directory, and I check your own records with them — never their private calendar. ${readOnlyNote()}`,
        records: [],
        grounded: false,
      };
    }
    const mine = listOrganizerBookings(user.id).filter(
      (booking) =>
        booking.artist_id === artist.user_id &&
        (booking.status === "accepted" || booking.status === "requested"),
    );
    const records = [`${publishedLine(artist)}`];
    if (mine.length) {
      records.push(
        ...mine
          .slice(0, MAX_LINES - 1)
          .map((booking) => `your booking with ${artist.stage_name}: ${bookingLine(booking, "organizer")}`),
      );
    } else {
      records.push(`no bookings recorded between you and ${artist.stage_name}`);
    }
    return {
      ...base,
      reply: `Artist calendars are private, so IQ can't see ${artist.stage_name}'s blocks or other organizers' requests — and I won't guess whether a date is free.\n\n${lines(
        records.map((line) => `• ${line}`),
      )}\n\nTo check a specific date, send a booking request from the Artists page; ${artist.stage_name} confirms or declines it. ${readOnlyNote()}`,
      records,
      grounded: true,
    };
  }

  if (intent === "bookings") {
    const bookings = listOrganizerBookings(user.id);
    const counts = bookings.reduce<Record<string, number>>((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {});
    const next = upcoming(bookings, ["requested", "accepted"]).slice(0, MAX_LINES);
    if (!bookings.length) {
      return {
        ...base,
        reply: `No artist booking requests are recorded for ${profile.business_name}. Browse published artists in the Artists console to start one; IQ can't send it for you. ${readOnlyNote()}`,
        records: [],
        grounded: false,
      };
    }
    const records = next.map((booking) => bookingLine(booking, "organizer"));
    return {
      ...base,
      reply: `You have ${plural(bookings.length, "artist booking")} (${statusSummary(counts)}).${
        records.length
          ? `\n\nUpcoming:\n${lines(records.map((line) => `• ${line}`))}`
          : "\n\nNo requested or accepted bookings are upcoming."
      }\n\nStatuses come from your booking records. Only the artist can accept or decline.`,
      records,
      grounded: true,
    };
  }

  if (intent === "agreements") {
    const agreements = listOrganizerAgreements(user.id);
    const missing = listAcceptedBookingsWithoutAgreement(user.id);
    const counts = agreements.reduce<Record<string, number>>((acc, agreement) => {
      acc[agreement.current_status] = (acc[agreement.current_status] || 0) + 1;
      return acc;
    }, {});
    const records = [
      `${plural(agreements.length, "agreement")} recorded (${statusSummary(counts)})`,
      ...(missing.length
        ? [`${plural(missing.length, "accepted booking")} without an agreement yet`]
        : []),
    ];
    return {
      ...base,
      reply: `${records[0]}.${missing.length ? ` ${records[1]} still need paperwork.` : ""}\n\nAgreements and payments are managed in the Agreements console. IQ reads their status but never sends, signs or settles anything.`,
      records,
      grounded: agreements.length > 0 || missing.length > 0,
    };
  }

  if (intent === "profile") {
    const records = [
      `${profile.business_name} · ${profile.business_type} · ${profile.city || "city not set"}`,
      `application status ${statusLabel(profile.status)}`,
    ];
    return {
      ...base,
      reply: `Your organizer profile: ${lines(records.map((line) => `• ${line}`))}. ${
        profile.decision_note ? `Reviewer note: ${profile.decision_note}. ` : ""
      }Profile edits happen on the application page. ${readOnlyNote()}`,
      records,
      grounded: true,
    };
  }

  return {
    ...base,
    reply: `I can help with ticket sales, event status, artist requests, agreements and the published directory — all from your own records. Try “how are my sales doing?”, “which events are drafts?” or “find a DJ in Bulawayo”. ${readOnlyNote()}`,
    records: [],
    grounded: false,
  };
}

function artistResult(user: User, message: string, intent: WorkspaceIntent): WorkspaceResult {
  const base = { surface: "artist" as const, intent };
  const profile = getArtistProfile(user.id);

  if (!profile) {
    return {
      ...base,
      reply: `I can't find an artist profile for this account, so there are no artist records to read. Start an application at /artist/apply; once your profile exists I can summarise requests, calendar and agreements. ${readOnlyNote()}`,
      records: [],
      grounded: false,
    };
  }

  if (intent === "greeting") {
    return {
      ...base,
      reply: `Hi! I'm IQ, your artist assistant for ${profile.stage_name}. Ask me about requests, your calendar and blocks, agreements, earnings or profile readiness. ${readOnlyNote()}`,
      records: [],
      grounded: false,
    };
  }

  if (intent === "capability") {
    return {
      ...base,
      reply: `I read your own records: booking requests, your recorded availability blocks, agreements and earnings, plus your profile readiness. I can't see other artists' records or promise a fee. ${readOnlyNote()}`,
      records: [],
      grounded: false,
    };
  }

  if (intent === "write_action") {
    return {
      ...base,
      reply: `I can't do that in this preview. To respond to a request or edit your calendar, use Bookings or Calendar in your console. ${readOnlyNote()}`,
      records: [],
      grounded: false,
    };
  }

  if (intent === "other_accounts") {
    return {
      ...base,
      reply: `I can only read ${profile.stage_name}'s own records. I can't show another artist's calendar or earnings, or reveal another organizer's enquiries. ${readOnlyNote()}`,
      records: [],
      grounded: false,
    };
  }

  if (intent === "availability") {
    const window = interpretQuestion(message);
    const start = new Date(window.startISO || Date.now());
    const end = new Date(window.endISO || Date.now() + AVAILABILITY_DAYS * 86_400_000);
    const label = window.dateLabel || `in the next ${AVAILABILITY_DAYS} days`;

    const blocks = listArtistAvailability(profile.user_id).filter(
      (block) =>
        new Date(block.starts_at).getTime() < end.getTime() &&
        new Date(block.ends_at).getTime() > start.getTime(),
    );
    const bookings = listArtistBookings(profile.user_id).filter((booking) => {
      if (booking.status !== "accepted" && booking.status !== "requested") return false;
      const at = new Date(booking.event_starts_at).getTime();
      return at >= start.getTime() && at <= end.getTime();
    });

    const records = [
      ...blocks.slice(0, 3).map(
        (block) =>
          `blocked ${formatDate(block.starts_at)} ${formatTimeRange(block.starts_at, block.ends_at)}${block.note ? ` · ${block.note}` : ""}`,
      ),
      ...bookings.slice(0, 3).map(
        (booking) =>
          `${booking.status === "accepted" ? "confirmed" : "request awaiting your reply"}: ${booking.event_title} — ${formatDate(booking.event_starts_at)} · ${booking.event_venue}`,
      ),
    ];

    if (!records.length) {
      return {
        ...base,
        reply: `I found no blocks, confirmed gigs or pending requests ${label}. That means no conflicts are recorded — it doesn't guarantee you're free, because offers may still arrive. ${readOnlyNote()}`,
        records: [],
        grounded: false,
      };
    }

    return {
      ...base,
      reply: `From your records ${label}:\n\n${lines(
        records.map((line) => `• ${line}`),
      )}\n\n“Confirmed” means an accepted booking and “request awaiting your reply” means you haven't answered yet. Blocks are your own calendar entries. ${readOnlyNote()}`,
      records,
      grounded: true,
    };
  }

  if (intent === "fees") {
    const fees = pendingFees(listArtistBookings(user.id));
    const range = feeRange(fees);
    const records = range
      ? [`proposed fees on ${plural(fees.length, "request")}: ${range} (discussion points)`]
      : [];
    return {
      ...base,
      reply: `EventIQ doesn't store an approved fee range or quotes for you yet, so I can't quote a rate as if it were platform data. ${
        records.length
          ? `What is recorded: ${records[0]}. A proposed fee is a discussion point, not confirmed earnings.`
          : "No proposed fees are recorded on your requests either."
      } ${readOnlyNote()}`,
      records,
      grounded: records.length > 0,
    };
  }

  if (intent === "bookings") {
    const bookings = listArtistBookings(profile.user_id);
    const counts = bookingCounts(profile.user_id);
    const next = upcoming(bookings, ["requested", "accepted"]).slice(0, MAX_LINES);
    if (!bookings.length) {
      return {
        ...base,
        reply: `No booking requests are recorded for ${profile.stage_name} yet. A published profile helps organizers find you; publish from your Profile page. ${readOnlyNote()}`,
        records: [],
        grounded: false,
      };
    }
    const records = next.map((booking) => bookingLine(booking, "artist"));
    return {
      ...base,
      reply: `You have ${plural(bookings.length, "booking")} recorded (${statusSummary(counts)}).${
        records.length
          ? `\n\nUpcoming:\n${lines(records.map((line) => `• ${line}`))}`
          : "\n\nNo requested or accepted bookings are upcoming."
      }\n\nRequests are answered in the Bookings console; IQ can't accept or decline for you.`,
      records,
      grounded: true,
    };
  }

  if (intent === "agreements") {
    const agreements = listArtistAgreements(profile.user_id);
    const counts = agreements.reduce<Record<string, number>>((acc, agreement) => {
      acc[agreement.current_status] = (acc[agreement.current_status] || 0) + 1;
      return acc;
    }, {});
    const records = [`${plural(agreements.length, "agreement")} recorded (${statusSummary(counts)})`];
    return {
      ...base,
      reply: `${records[0]}.\n\nAgreements are reviewed and signed in the Agreements console. IQ reads their status but never sends, signs or changes terms.`,
      records,
      grounded: agreements.length > 0,
    };
  }

  if (intent === "earnings") {
    const earnings = earningsSummary(profile.user_id);
    const records = [
      `contracted ${formatMoney(earnings.contractedCents)} across ${plural(earnings.agreementCount, "agreement")}`,
      `received ${formatMoney(earnings.receivedCents)}`,
      `outstanding ${formatMoney(earnings.outstandingCents)}`,
      `overdue ${formatMoney(earnings.overdueCents)}`,
    ];
    return {
      ...base,
      reply: `From accepted agreements and confirmed payments:\n\n${lines(
        records.map((line) => `• ${line}`),
      )}\n\nOnly accepted agreements count as contracted, and only payments you confirm count as received. Proposed fees are never counted. EventIQ doesn't process artist payments.`,
      records,
      grounded: true,
    };
  }

  if (intent === "profile") {
    const gaps = profileGaps(profile);
    const records = [
      `visibility ${statusLabel(profile.visibility)} · verification ${statusLabel(profile.verification_status)} · ${profile.accepting_bookings ? "accepting requests" : "requests paused"}`,
      ...(gaps.length ? [`profile gaps: ${gaps.join("; ")}`] : []),
    ];
    return {
      ...base,
      reply: `Your profile status: ${lines(records.map((line) => `• ${line}`))}.\n\n${
        gaps.length
          ? "Fixing those items improves your directory listing. Make the edits on the Profile page."
          : "Your profile has no recorded gaps. Make changes on the Profile page."
      } ${readOnlyNote()}`,
      records,
      grounded: true,
    };
  }

  return {
    ...base,
    reply: `I can help with your requests, calendar and blocks, agreements, earnings and profile readiness — all from your own records. Try “am I free next weekend?”, “what requests are waiting?” or “how much have I earned?”. ${readOnlyNote()}`,
    records: [],
    grounded: false,
  };
}

export function buildWorkspaceResult(user: User, message: string): WorkspaceResult {
  const surface: WorkspaceSurface = user.role === "artist" ? "artist" : "organizer";
  const intent = classifyWorkspaceIntent(message, surface);
  return surface === "artist"
    ? artistResult(user, message, intent)
    : organizerResult(user, message, intent);
}

export function workspaceSuggestions(surface: WorkspaceSurface) {
  return surface === "artist"
    ? [
        "Am I free next weekend?",
        "What requests are waiting?",
        "How much have I earned?",
      ]
    : [
        "How are my sales doing?",
        "Which events are drafts?",
        "Find a DJ in Bulawayo",
      ];
}
