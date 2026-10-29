# IQ by EventIQ — Stage 2 plan

Status: proposed, awaiting approval. No Stage 2 capability has been built yet.
Baseline: Stage 1 committed as `635f87d` (public, grounded event discovery only).

## 1. Inspection findings

### Stage 1 inventory (committed)

- Public launcher `src/components/iq/iq-launcher.tsx`, mounted in `src/app/layout.tsx`
  and hidden on private route prefixes.
- `src/app/api/iq/chat/route.ts`: GET restores the visitor's conversation, POST answers
  a question. Same-origin check, 800-character message cap, 30 requests per 10 minutes
  per IP, 12-turn conversation cap, ownership checked against the session user or the
  hashed visitor token.
- `src/lib/iq/discovery.ts`: deterministic filter extraction (city, category, dates,
  price, keyword) and SQL limited to `status = 'approved'` and upcoming events.
- `src/lib/iq/provider.ts`: mock provider composed from retrieved listings, plus an
  OpenAI-compatible adapter. Provider keys stay server-side.
- `src/lib/iq/store.ts`: `iq_conversations` / `iq_messages`, anonymous tokens stored
  only as SHA-256 hashes, 30-day pruning of anonymous conversations.

### Data model that exists

`users`, `organizer_profiles`, `events`, `ticket_types`, `orders`, `order_items`,
`tickets`, `scan_events`, `audit_logs`, `artist_profiles`, `artist_verification_requests`,
`artist_documents`, `artist_bookings`, `artist_availability`, `artist_agreements`,
`artist_agreement_versions`, `artist_invoices`, `artist_payments`, `artist_reports`,
`sessions`, `user_mfa`, `user_recovery_codes`, `iq_conversations`, `iq_messages`.

### Data model that does not exist

Tasks, expenses and budgets, venue directory, suppliers, artist fee ranges or quotation
records, messaging or enquiry threads, date holds as a distinct state, outbound
notification delivery.

### Authentication and authorisation

- Server-side sessions with revocation, scrypt passwords, same-origin CSRF checks.
- `requireUser` / `requireRolePage` for server pages; roles are attendee, organizer,
  artist, gate, admin and ceo.
- Ownership is enforced per query with explicit `organizer_id` / `artist_id` scoping.
- `writeAudit` records actor, action, entity and before/after payloads.
- SQLite has no Row Level Security. Isolation is application-level and must be proven
  by tests.

### TOTP two-factor status

Implemented and working: enrolment, verification, recovery codes, encrypted secrets,
replay protection, revocable sessions. Any user who enrols is challenged at login.

Not implemented: artists are not required to enrol. `roleRequiresMfa` covers gate,
admin and ceo only, and the documented policy value is `MFA_ENFORCEMENT=staff`.
Artist two-factor authentication is therefore available but not enforced.

### Availability semantics

`artist_availability` stores unavailable blocks. Bookings move through
`requested`, `accepted`, `declined`, `withdrawn` and `cancelled`. There is no
tentative-hold state and no record saying an artist maintains no calendar at all.
IQ must map records to: confirmed (accepted booking), awaiting confirmation
(requested booking), unavailable (block), available (no conflicts recorded), and
unknown. It must never present "no records found" as "available" without that
qualification.

### Integrations

None. There is no email, SMS, WhatsApp or messaging sender, no live payment provider
and no external booking channel. Preference flags are stored but nothing dispatches
them. IQ cannot claim an enquiry was sent, a booking was confirmed or a payment moved.

### Existing defect to fix before adding surfaces

`latestConversation` in `src/lib/iq/store.ts` ignores the conversation surface, and
`/api/iq/chat` accepts any user-owned conversation id. Once workspace conversations
exist, an organiser's chat could resurface in the public panel. Both paths must be
scoped to their surface.

### Testing

No test framework is installed. Verification is script-based (`curl`, headless Chrome
captures, one-off Node scripts under `.data/tmp`).

## 2. Scope decisions

Capabilities are grouped so each stage is independently testable and reversible.

- Stage 2.2: authenticated, role-aware entry point with no new data access.
- Stage 2.3: read-only capabilities backed by verified records.
- Stage 2.4: schema proposal only, no migration.
- Stage 2.5: draft preparation; external sending stays disabled.
- Stage 2.6: attendee and internal operations assistance, scoped separately.
- Stage 2.7: controlled write actions after read-only behaviour is reliable.

## 3. Stage 2.2 — role-aware entry point

- Add `src/app/organizer/layout.tsx` and `src/app/artist/layout.tsx` that render
  `<IqWorkspace surface="organizer|artist" />` after a server-side session and profile
  check. The layout is the single integration point, avoiding edits across the console
  pages.
- Add `src/components/iq/iq-workspace.tsx` in the existing visual language. Listing and
  record cards are labelled "From your EventIQ records"; generated text is labelled
  "IQ guidance · not EventIQ data". The panel states that IQ cannot book, pay, publish,
  message or change prices.
- Add `src/app/api/iq/workspace/route.ts`: same-origin check, authentication required,
  role and surface derived from the session rather than the request body.
- Scope restore and continue-by-id to the conversation surface in
  `src/lib/iq/store.ts` and `src/app/api/iq/chat/route.ts`.
- Add `src/lib/iq/workspace.ts` (orchestration and quotas) and `src/lib/iq/intent.ts`
  (deterministic intent to static tool mapping).

Database change: additive `iq_usage (id, user_id, day, requests)` with a unique index on
`(user_id, day)` for daily cost control. No other schema changes.

## 4. Stage 2.3 — read-only capabilities

The model never selects or executes tools. A static registry maps a deterministically
detected intent to one server-side query function. The provider only phrases the facts
that function returns.

Organisers (approved organisers, own records only):

1. Ticket sales and revenue summary per own event.
2. Upcoming events and readiness gaps: missing cover image, no ticket types, zero
   capacity, upcoming event not approved.
3. Own artist booking and enquiry statuses.
4. Artist discovery for a date, city and genre across published, bookable profiles,
   including verified availability states and a per-candidate match explanation.
5. Draft marketing copy, event descriptions and schedule suggestions, clearly marked as
   generated and not saved.

Artists (own records only):

1. Availability for a date range with the five states described above.
2. Own enquiries, bookings and their statuses.
3. Agreement statuses.
4. Earnings summary from invoices and recorded or received payments.
5. Itinerary draft from own confirmed booking details.

Refused in 2.3 with an explicit reason: sending enquiries, confirming bookings, refunds,
price changes, publishing, expense and task tracking, venue and supplier discovery, and
budget-versus-actual reporting.

Availability and fee honesty rules:

- Fees are not recorded on artist profiles. Budget filtering is impossible, so IQ states
  that fee data is not recorded instead of ranking candidates by an invented fee.
- Availability is reported only from blocks and accepted bookings. With no calendar
  records the answer is unknown, not available.

## 5. Stage 2.4 and beyond (proposal only)

- 2.4: read-only booking intelligence needs no new booking schema. Optional additions,
  only if approved: `artist_profiles.fee_min_cents`, `fee_max_cents`, `currency`, and
  `artist_bookings.hold_until` for genuine tentative holds. Deferred until 2.3 is live.
- 2.5: additive `iq_drafts (id, user_id, kind, payload_json, created_at, used_at)`.
  IQ prepares an enquiry draft; a human submits it through the existing booking flow.
  External sending stays disabled because no messaging integration exists.
- 2.6: attendee account help limited to the signed-in user's own orders, tickets and
  policies, and admin-only operations summaries.
- 2.7: write actions behind confirmation, idempotency keys and audit logging.

## 6. Security model

- Authentication and authorisation enforced server-side on every protected operation.
- Role and surface taken from the session; the browser cannot request a role.
- Every query scoped by `organizer_id` or `artist_id`; artist discovery uses a narrow
  projection that excludes email, phone and private calendar details.
- No arbitrary SQL, shell or tool execution. Tool inputs are validated and outputs are
  typed; the model cannot call them directly.
- Read-only operations are separated from all write paths. No writes exist in 2.2 or 2.3.
- Database text is delimited as data in the system prompt; instructions inside event
  descriptions or bios are never followed.
- Provider keys remain server-side, with per-user daily quotas, token caps, burst limits
  and conversation turn caps.
- Failures degrade honestly: unavailable data, provider errors and quota limits produce
  explicit messages and never fabricated results.
- Audit logging applies to record-changing actions; routine questions are not audited.

## 7. Risks and mitigations

1. Cross-tenant leakage: highest risk. Scoped queries plus explicit A-cannot-see-B tests.
2. Contact-data leak in artist discovery: narrow projection, no contact details sent to
   the provider or browser.
3. Prompt injection through stored text: data-only delimiters and a malicious-description
   test that proves no leakage.
4. Invented availability or fees: state mapping limited to recorded facts; explicit
   "unknown" and "not recorded" answers.
5. Cost or abuse: daily quota (proposed 40 per user), 600 max tokens, 12-turn cap,
   30 requests per 10 minutes, mock provider default until a key is configured.
6. Artist two-factor enforcement may interrupt existing artist logins until enrolment
   completes. Needs an explicit product decision.
7. No database-level row security: application-level enforcement documented and tested.

## 8. Verification plan

Executed when each stage is built, with results reported honestly:

- Stage 1 suite re-run: public discovery still grounded, guards still return 401/403/404,
  413/409/429 as before.
- Anonymous workspace request returns 401; attendee returns 403.
- Organiser A cannot retrieve organiser B's sales, events or bookings.
- Artist A cannot retrieve artist B's calendar, enquiries or earnings.
- Organiser asking about a named artist receives only published fields.
- Budget question returns "fee data is not recorded".
- Availability returns unknown with no calendar, unavailable with a block, confirmed with
  an accepted booking, awaiting confirmation with a requested booking.
- Injected instructions in an event description do not change permissions or leak data.
- Provider failure returns an honest error; quota exhaustion returns 429.
- Type check, lint and production build pass.
- Desktop and 390px screenshots of the workspace panel, with a clean browser console.

## 9. Decisions pending approval

1. Artist two-factor: extend the policy to support `MFA_ENFORCEMENT=staff,artists` and
   enable it by default in production, or leave artist enrolment optional for now.
2. Daily IQ quota default of 40 requests per user per day.
3. Build 2.2 and 2.3 together as one change, with `iq_usage` as the only schema addition,
   and defer 2.4 and 2.5 until those are verified.
