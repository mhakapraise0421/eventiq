export type Role = "attendee" | "organizer" | "artist" | "gate" | "admin" | "ceo";

export type EventStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "completed";

export type OrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "refunded"
  | "partially_refunded";

export type OrganizerStatus =
  | "pending"
  | "requires_modification"
  | "approved"
  | "rejected";

export type ScanResult =
  | "accepted"
  | "duplicate"
  | "invalid"
  | "wrong_event"
  | "not_paid"
  | "void"
  | "unauthorised";

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  phone: string | null;
  city: string | null;
  role: Role;
  status: "active" | "suspended";
  notify_email?: number;
  notify_sms?: number;
  notify_whatsapp?: number;
  created_at: string;
}

export interface OrganizerProfile {
  user_id: string;
  business_name: string;
  business_type: string;
  registration_no: string | null;
  city: string | null;
  website: string | null;
  description: string;
  kyc_document: string | null;
  status: OrganizerStatus;
  decision_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface OrganizerApplication extends OrganizerProfile {
  user_name: string;
  user_email: string;
  user_phone: string | null;
}

export interface EventRecord {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string;
  category: string;
  city: string;
  venue: string;
  address: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_image: string | null;
  organizer_id: string;
  status: EventStatus;
  featured: number;
  age_limit: string | null;
  terms: string | null;
  capacity: number;
  created_at: string;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  scheme_json: string | null;
  organizer_name?: string;
  organizer_business?: string;
  min_price_cents?: number;
  max_price_cents?: number;
  tickets_sold?: number;
  total_capacity?: number;
  tier_count?: number;
}

export interface TicketType {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  capacity: number;
  sold: number;
  sales_start: string | null;
  sales_end: string | null;
  max_per_order: number;
  perks: string | null;
  sort_order: number;
}

export interface Order {
  id: string;
  reference: string;
  user_id: string;
  event_id: string;
  status: OrderStatus;
  subtotal_cents: number;
  fee_cents: number;
  total_cents: number;
  commission_cents: number;
  refunded_cents: number;
  currency: string;
  payment_method: string | null;
  payment_ref: string | null;
  provider: string | null;
  idempotency_key: string | null;
  expires_at: string;
  created_at: string;
  paid_at: string | null;
  event_title?: string;
  event_slug?: string;
  event_starts_at?: string;
  event_cover?: string;
  user_name?: string;
  user_email?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  ticket_type_id: string;
  quantity: number;
  unit_price_cents: number;
  ticket_type_name?: string;
  ticket_type_description?: string;
  perks?: string | null;
}

export interface Ticket {
  id: string;
  code: string;
  order_id: string;
  ticket_type_id: string;
  event_id: string;
  holder_name: string;
  status: "valid" | "used" | "void";
  issued_at: string;
  used_at: string | null;
  used_gate: string | null;
  used_by: string | null;
  event_title?: string;
  event_slug?: string;
  event_starts_at?: string;
  event_ends_at?: string | null;
  event_category?: string;
  venue?: string;
  city?: string;
  cover_image?: string | null;
  ticket_type_name?: string;
  order_reference?: string;
}

export interface ScanEvent {
  id: string;
  ticket_id: string | null;
  ticket_code: string;
  event_id: string | null;
  result: ScanResult;
  message: string | null;
  gate: string | null;
  scanned_by: string | null;
  scanner_name: string | null;
  device_id: string | null;
  client_scan_id?: string | null;
  source?: string;
  gate_id?: string | null;
  mode?: string;
  created_at: string;
  event_title?: string;
  holder_name?: string;
  ticket_type_name?: string;
}

export type GateKind = "turnstile" | "overhead" | "handheld";export type GateDirection = "in" | "out" | "both";
export type GateStatus = "active" | "maintenance" | "closed";

export interface Gate {
  id: string;
  event_id: string;
  name: string;
  kind: GateKind;
  direction: GateDirection;
  status: GateStatus;
  open_ms: number;
  created_at: string;
  updated_at: string;
  event_title?: string;
  event_starts_at?: string;
  device_count?: number;
  paired_count?: number;
  online_count?: number;
  last_seen_at?: string | null;
}

export interface PriceRequest {
  id: string;
  event_id: string;
  ticket_type_id: string;
  old_price_cents: number;
  new_price_cents: number;
  requested_by: string;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  event_title?: string;
  ticket_type_name?: string;
  requester_name?: string;
}

export interface Device {
  id: string;
  name: string;
  serial: string;
  type: "scanner" | "printer" | "encoder" | "gate_controller" | "bridge";
  status: "active" | "maintenance" | "retired";
  assigned_event_id: string | null;
  assigned_staff_id: string | null;
  gate_id: string | null;
  api_key_hash: string | null;
  api_key_prefix: string | null;
  paired_at: string | null;
  last_seen_at: string | null;
  last_seen_ip: string | null;
  firmware: string | null;
  mode: string;
  assigned_at: string | null;
  updated_at: string;
  assigned_event_title?: string | null;
  assigned_staff_name?: string | null;
  gate_name?: string | null;
  gate_status?: string | null;
  gate_kind?: string | null;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  outcome: string;
  before_json: string | null;
  after_json: string | null;
  ip: string | null;
  created_at: string;
}

export interface StaffAssignment {
  id: string;
  event_id: string;
  user_id: string;
  gate_name: string;
  created_at: string;
  event_title: string;
  event_starts_at: string;
  user_name: string;
  user_email: string;
}

export type ArtistVerificationStatus =
  | "not_submitted"
  | "pending"
  | "requires_info"
  | "verified"
  | "rejected";

export type ArtistVisibility = "draft" | "published";

export interface ArtistProfile {
  user_id: string;
  slug: string;
  stage_name: string;
  category: string;
  genres: string | null;
  bio: string;
  city: string | null;
  region: string | null;
  profile_image: string | null;
  cover_image: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  x: string | null;
  tiktok: string | null;
  youtube: string | null;
  media_json: string | null;
  performance_history: string | null;
  availability_note: string | null;
  booking_prefs: string | null;
  technical_rider: string | null;
  visibility: ArtistVisibility;
  verification_status: ArtistVerificationStatus;
  accepting_bookings: number;
  created_at: string;
  updated_at: string;
}

export interface ArtistProfileWithUser extends ArtistProfile {
  user_name: string;
  user_email: string;
  user_phone: string | null;
}

export interface ArtistVerificationRequest {
  id: string;
  artist_id: string;
  status: Exclude<ArtistVerificationStatus, "not_submitted">;
  note: string | null;
  decision_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ArtistVerificationWithArtist extends ArtistVerificationRequest {
  stage_name: string;
  slug: string;
  category: string;
  city: string | null;
  bio: string;
  visibility: ArtistVisibility;
  user_name: string;
  user_email: string;
  user_phone: string | null;
  document_count?: number;
}

export interface ArtistDocument {
  id: string;
  artist_id: string;
  verification_id: string | null;
  label: string;
  file_name: string;
  mime: string;
  size: number;
  storage_path: string;
  sha256: string;
  uploaded_at: string;
}

export interface ArtistMediaLink {
  label: string;
  url: string;
}

export type BookingStatus =
  | "requested"
  | "accepted"
  | "declined"
  | "withdrawn"
  | "cancelled";

export interface ArtistBooking {
  id: string;
  artist_id: string;
  organizer_id: string;
  event_id: string;
  status: BookingStatus;
  proposed_fee_cents: number | null;
  currency: string;
  message: string | null;
  response_note: string | null;
  created_at: string;
  responded_at: string | null;
}

export interface ArtistBookingWithEvent extends ArtistBooking {
  event_title: string;
  event_slug: string;
  event_starts_at: string;
  event_ends_at: string | null;
  event_venue: string;
  event_city: string;
  event_status: string;
  artist_stage_name: string;
  artist_slug: string;
  artist_verification_status: ArtistVerificationStatus;
  organizer_name: string;
  organizer_business: string | null;
  organizer_email: string;
  organizer_phone: string | null;
}

export interface ArtistAvailability {
  id: string;
  artist_id: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
  created_at: string;
}
