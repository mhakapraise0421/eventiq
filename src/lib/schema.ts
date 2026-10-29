export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  role TEXT NOT NULL DEFAULT 'attendee',
  status TEXT NOT NULL DEFAULT 'active',
  notify_email INTEGER NOT NULL DEFAULT 1,
  notify_sms INTEGER NOT NULL DEFAULT 0,
  notify_whatsapp INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organizer_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  business_name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  registration_no TEXT,
  city TEXT,
  website TEXT,
  description TEXT NOT NULL,
  kyc_document TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  decision_note TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  tagline TEXT,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  venue TEXT NOT NULL,
  address TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  cover_image TEXT,
  organizer_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'draft',
  featured INTEGER NOT NULL DEFAULT 0,
  age_limit TEXT,
  terms TEXT,
  capacity INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  submitted_at TEXT,
  approved_by TEXT,
  approved_at TEXT,
  rejection_reason TEXT,
  scheme_json TEXT
);

CREATE TABLE IF NOT EXISTS ticket_types (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  capacity INTEGER NOT NULL,
  sold INTEGER NOT NULL DEFAULT 0,
  sales_start TEXT,
  sales_end TEXT,
  max_per_order INTEGER NOT NULL DEFAULT 6,
  perks TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  event_id TEXT NOT NULL REFERENCES events(id),
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal_cents INTEGER NOT NULL,
  fee_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  refunded_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT,
  payment_ref TEXT,
  provider TEXT,
  idempotency_key TEXT UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ticket_type_id TEXT NOT NULL REFERENCES ticket_types(id),
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL REFERENCES orders(id),
  ticket_type_id TEXT NOT NULL REFERENCES ticket_types(id),
  event_id TEXT NOT NULL REFERENCES events(id),
  holder_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'valid',
  issued_at TEXT NOT NULL,
  used_at TEXT,
  used_gate TEXT,
  used_by TEXT
);

CREATE TABLE IF NOT EXISTS gates (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'turnstile',
  direction TEXT NOT NULL DEFAULT 'in',
  status TEXT NOT NULL DEFAULT 'active',
  open_ms INTEGER NOT NULL DEFAULT 600,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(event_id, name)
);

CREATE TABLE IF NOT EXISTS scan_events (
  id TEXT PRIMARY KEY,
  ticket_id TEXT,
  ticket_code TEXT NOT NULL,
  event_id TEXT,
  result TEXT NOT NULL,
  message TEXT,
  gate TEXT,
  scanned_by TEXT,
  scanner_name TEXT,
  device_id TEXT,
  client_scan_id TEXT,
  source TEXT NOT NULL DEFAULT 'browser',
  gate_id TEXT REFERENCES gates(id),
  mode TEXT NOT NULL DEFAULT 'online',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS price_requests (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  ticket_type_id TEXT NOT NULL REFERENCES ticket_types(id),
  old_price_cents INTEGER NOT NULL,
  new_price_cents INTEGER NOT NULL,
  requested_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event_staff (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  gate_name TEXT NOT NULL DEFAULT 'Main gate',
  created_at TEXT NOT NULL,
  UNIQUE(event_id, user_id, gate_name)
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  serial TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'scanner',
  status TEXT NOT NULL DEFAULT 'active',
  assigned_event_id TEXT REFERENCES events(id),
  assigned_staff_id TEXT REFERENCES users(id),
  gate_id TEXT REFERENCES gates(id),
  api_key_hash TEXT,
  api_key_prefix TEXT,
  paired_at TEXT,
  last_seen_at TEXT,
  last_seen_ip TEXT,
  firmware TEXT,
  mode TEXT NOT NULL DEFAULT 'online',
  assigned_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_pairings (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_name TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  outcome TEXT NOT NULL DEFAULT 'success',
  before_json TEXT,
  after_json TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artist_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  slug TEXT NOT NULL UNIQUE,
  stage_name TEXT NOT NULL,
  category TEXT NOT NULL,
  genres TEXT,
  bio TEXT NOT NULL DEFAULT '',
  city TEXT,
  region TEXT,
  profile_image TEXT,
  cover_image TEXT,
  website TEXT,
  instagram TEXT,
  facebook TEXT,
  x TEXT,
  tiktok TEXT,
  youtube TEXT,
  media_json TEXT,
  performance_history TEXT,
  availability_note TEXT,
  booking_prefs TEXT,
  technical_rider TEXT,
  visibility TEXT NOT NULL DEFAULT 'draft',
  verification_status TEXT NOT NULL DEFAULT 'not_submitted',
  accepting_bookings INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artist_verification_requests (
  id TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  decision_note TEXT,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artist_documents (
  id TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verification_id TEXT REFERENCES artist_verification_requests(id),
  label TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favorite_events (  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS recently_viewed_events (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  viewed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS user_interests (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(status, starts_at);
CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_event ON ticket_types(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_event ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order ON tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_gates_event ON gates(event_id, status);
CREATE INDEX IF NOT EXISTS idx_scan_events_event ON scan_events(event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorite_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_recent_user ON recently_viewed_events(user_id, viewed_at);
CREATE INDEX IF NOT EXISTS idx_interests_user ON user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_artist_profiles_visibility
  ON artist_profiles(visibility, verification_status);
CREATE INDEX IF NOT EXISTS idx_artist_verifications_status
  ON artist_verification_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_artist_verifications_artist
  ON artist_verification_requests(artist_id, created_at);
CREATE INDEX IF NOT EXISTS idx_artist_documents_artist
  ON artist_documents(artist_id, uploaded_at);

CREATE TABLE IF NOT EXISTS artist_bookings (
  id TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organizer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'requested',
  proposed_fee_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  message TEXT,
  response_note TEXT,
  created_at TEXT NOT NULL,
  responded_at TEXT
);

CREATE TABLE IF NOT EXISTS artist_availability (
  id TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artist_bookings_artist
  ON artist_bookings(artist_id, status);
CREATE INDEX IF NOT EXISTS idx_artist_bookings_organizer
  ON artist_bookings(organizer_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_bookings_active
  ON artist_bookings(artist_id, event_id)
  WHERE status IN ('requested', 'accepted');
CREATE INDEX IF NOT EXISTS idx_artist_availability_artist
  ON artist_availability(artist_id, starts_at);

CREATE TABLE IF NOT EXISTS artist_agreements (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES artist_bookings(id) ON DELETE CASCADE,
  artist_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organizer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft',
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artist_agreement_versions (
  id TEXT PRIMARY KEY,
  agreement_id TEXT NOT NULL REFERENCES artist_agreements(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  fee_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  deposit_cents INTEGER NOT NULL DEFAULT 0,
  deposit_due_on TEXT,
  balance_due_on TEXT,
  cancellation_terms TEXT,
  transport_arrangements TEXT,
  accommodation_arrangements TEXT,
  technical_requirements TEXT,
  responsibilities TEXT,
  additional_conditions TEXT,
  change_summary TEXT,
  response_note TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  sent_at TEXT,
  responded_at TEXT,
  UNIQUE(agreement_id, version)
);

CREATE TABLE IF NOT EXISTS artist_invoices (
  id TEXT PRIMARY KEY,
  agreement_id TEXT NOT NULL REFERENCES artist_agreements(id) ON DELETE CASCADE,
  artist_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organizer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  number TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'issued',
  issued_on TEXT NOT NULL,
  due_on TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artist_payments (
  id TEXT PRIMARY KEY,
  agreement_id TEXT NOT NULL REFERENCES artist_agreements(id) ON DELETE CASCADE,
  invoice_id TEXT REFERENCES artist_invoices(id) ON DELETE SET NULL,
  artist_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organizer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'recorded',
  method TEXT NOT NULL,
  reference TEXT,
  note TEXT,
  paid_on TEXT NOT NULL,
  recorded_by TEXT NOT NULL REFERENCES users(id),
  recorded_at TEXT NOT NULL,
  confirmed_by TEXT REFERENCES users(id),
  confirmed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artist_agreements_artist
  ON artist_agreements(artist_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_artist_agreements_organizer
  ON artist_agreements(organizer_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_artist_agreement_versions_agreement
  ON artist_agreement_versions(agreement_id, version);
CREATE INDEX IF NOT EXISTS idx_artist_invoices_artist
  ON artist_invoices(artist_id, issued_on);
CREATE INDEX IF NOT EXISTS idx_artist_invoices_agreement
  ON artist_invoices(agreement_id);
CREATE INDEX IF NOT EXISTS idx_artist_payments_agreement
  ON artist_payments(agreement_id, status);
CREATE INDEX IF NOT EXISTS idx_artist_payments_artist
  ON artist_payments(artist_id, paid_on);

CREATE TABLE IF NOT EXISTS artist_reports (
  id TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  payment_status TEXT,
  booking_status TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'generated',
  storage_key TEXT NOT NULL UNIQUE,
  pdf_sha256 TEXT NOT NULL,
  data_sha256 TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  generated_by TEXT NOT NULL REFERENCES users(id),
  supersedes_id TEXT REFERENCES artist_reports(id) ON DELETE SET NULL,
  superseded_by_id TEXT REFERENCES artist_reports(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artist_reports_artist
  ON artist_reports(artist_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  revoked_at TEXT,
  revoked_reason TEXT
);

CREATE TABLE IF NOT EXISTS user_mfa (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret_cipher TEXT NOT NULL,
  confirmed_at TEXT,
  last_used_step INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_recovery_codes_user ON user_recovery_codes(user_id, used_at);

CREATE TABLE IF NOT EXISTS iq_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  visitor_token_hash TEXT,
  surface TEXT NOT NULL DEFAULT 'public',
  title TEXT,
  created_at TEXT NOT NULL,
  last_message_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS iq_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES iq_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  sources_json TEXT,
  provider TEXT,
  model TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_iq_conversations_user
  ON iq_conversations(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_iq_conversations_token
  ON iq_conversations(visitor_token_hash);
CREATE INDEX IF NOT EXISTS idx_iq_messages_conversation
  ON iq_messages(conversation_id, created_at);
`;
