import "server-only";

export type WorkspaceSurface = "organizer" | "artist";

export type WorkspaceIntent =
  | "greeting"
  | "capability"
  | "write_action"
  | "availability"
  | "sales"
  | "earnings"
  | "fees"
  | "events"
  | "artist_search"
  | "bookings"
  | "agreements"
  | "profile"
  | "other_accounts"
  | "unknown";

const GREETING = /^(hi|hello|hey|good (morning|afternoon|evening))\b/;
const CAPABILITY =
  /(what can you do|who are you|how do you work|what do you do|how can you help|what is iq)/;

/**
 * Actions the workspace must never perform or claim to perform. The preview is
 * read-only, so these are answered with an explanation rather than a tool call.
 */
const WRITE_ACTION =
  /\b(create|publish|unpublish|cancel|resend|send|email|whatsapp|message (the|this|them|an?)|book (the|an?|this|him|her|them)|reserve|put (a|on) hold|confirm (the|a|this|that|my)|accept (the|a|this|that)|decline (the|a|this|that)|reject|withdraw|pay|refund|charge|sign|delete|remove|reset|turn off|switch off|approve|shortlist|assign)\b/;

const AVAILABILITY =
  /\b(available|availability|free on|free (this|next)|busy|blocked|block out|calendar|schedule|clash|conflict|double[- ]?booked|open on)\b/;

const SALES =
  /\b(sales|revenue|gross|sold|sell|tickets? sold|how much (did|have) (i|we) (make|earn)|performance|doing|numbers|income)\b/;

const EARNINGS =
  /\b(earn|earnings|earned|income|paid|payments?|outstanding|owed|receivable|contract(ed)? value|payout)\b/;

const FEES = /\b(fee|fees|rate|rates|quote|quotes|pricing|price|prices|charge|budget)\b/;

const EVENTS = /\b(events?|drafts?|listed|live|pending|upcoming|published|submitted)\b/;

const ARTIST_SEARCH =
  /\b(find|search|looking for|recommend|suggest|artists?|musicians?|djs?|bands?|comedians?|performers?|talent|who (is|are)|line[- ]?up)\b/;

const BOOKINGS =
  /\b(bookings?|requests?|enquir(y|ies)|inquir(y|ies)|invites?|offers?|interested)\b/;

const AGREEMENTS = /\b(agreements?|contracts?|invoices?|paperwork|terms)\b/;

const PROFILE = /\b(profile|verification|verified|badge|ready|readiness|visibility|published|directory|bio|online)\b/;

const OTHER_ACCOUNTS =
  /\b(other (artists?|organi[sz]ers?)|someone else|another (artist|organi[sz]er)|competitor|their (calendar|bookings|earnings|sales)|all artists|every artist|platform[- ]wide|everyone'?s)\b/;

export function classifyWorkspaceIntent(
  message: string,
  surface: WorkspaceSurface,
): WorkspaceIntent {
  const lower = message.toLowerCase().trim();

  if (GREETING.test(lower) && lower.length < 24) return "greeting";
  if (CAPABILITY.test(lower)) return "capability";
  if (OTHER_ACCOUNTS.test(lower)) return "other_accounts";
  if (WRITE_ACTION.test(lower)) return "write_action";
  if (AVAILABILITY.test(lower)) return "availability";

  if (surface === "organizer") {
    if (SALES.test(lower)) return "sales";
  } else if (EARNINGS.test(lower) || SALES.test(lower)) {
    return "earnings";
  }

  if (FEES.test(lower)) return "fees";
  if (surface === "organizer" && EVENTS.test(lower)) return "events";
  if (surface === "organizer" && ARTIST_SEARCH.test(lower)) return "artist_search";
  if (BOOKINGS.test(lower)) return "bookings";
  if (AGREEMENTS.test(lower)) return "agreements";
  if (PROFILE.test(lower)) return "profile";

  if (surface === "artist" && ARTIST_SEARCH.test(lower)) return "bookings";
  if (surface === "artist" && EVENTS.test(lower)) return "bookings";

  return "unknown";
}
