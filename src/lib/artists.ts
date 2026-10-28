import "server-only";
import { all, get, run, transaction } from "./db";
import { randomId } from "./format";
import { writeAudit } from "./audit";
import {
  ARTIST_CATEGORIES,
  ARTIST_CATEGORY_SET,
  ARTIST_GENRE_SET,
  ARTIST_GENRES,
  ARTIST_REGIONS,
  MAX_ARTIST_DOCUMENTS,
  MAX_ARTIST_GENRES,
  MAX_ARTIST_MEDIA_LINKS,
} from "./artist-options";
import { deletePrivateFile, hashBytes, savePrivateFile } from "./storage";
import type {
  ArtistDocument,
  ArtistMediaLink,
  ArtistProfile,
  ArtistProfileWithUser,
  ArtistVerificationRequest,
  ArtistVerificationStatus,
  ArtistVerificationWithArtist,
  User,
} from "./types";

const BIO_MIN = 40;
const BIO_PUBLISH_MIN = 80;

export interface ArtistProfileInput {
  stageName: string;
  category: string;
  genres: string[];
  bio: string;
  city: string;
  region: string;
  profileImage: string;
  coverImage: string;
  website: string;
  instagram: string;
  facebook: string;
  x: string;
  tiktok: string;
  youtube: string;
  media: ArtistMediaLink[];
  performanceHistory: string;
  availabilityNote: string;
  bookingPrefs: string;
  technicalRider: string;
}

type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

function text(value: string | undefined, max: number) {
  return (value || "").trim().slice(0, max);
}

function validUrl(value: string) {
  if (!value) return true;
  if (value.length > 300) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseGenres(profile: Pick<ArtistProfile, "genres">): string[] {
  return (profile.genres || "")
    .split(",")
    .map((genre) => genre.trim())
    .filter(Boolean);
}

export function parseMedia(profile: Pick<ArtistProfile, "media_json">): ArtistMediaLink[] {
  if (!profile.media_json) return [];
  try {
    const parsed = JSON.parse(profile.media_json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ArtistMediaLink =>
          !!item &&
          typeof item === "object" &&
          typeof (item as ArtistMediaLink).label === "string" &&
          typeof (item as ArtistMediaLink).url === "string",
      )
      .slice(0, MAX_ARTIST_MEDIA_LINKS);
  } catch {
    return [];
  }
}

export function validateArtistProfileInput(
  input: Partial<ArtistProfileInput>,
): Validated<ArtistProfileInput> {
  const stageName = text(input.stageName, 60).replace(/\s+/g, " ");
  if (stageName.length < 2) {
    return { ok: false, error: "Enter your artist or stage name." };
  }
  const category = text(input.category, 40);
  if (!ARTIST_CATEGORY_SET.has(category)) {
    return { ok: false, error: "Select your artist category." };
  }
  const genres = Array.from(
    new Set((input.genres || []).map((genre) => text(genre, 40)).filter(Boolean)),
  );
  if (genres.length > MAX_ARTIST_GENRES) {
    return { ok: false, error: `Choose up to ${MAX_ARTIST_GENRES} genres.` };
  }
  if (genres.some((genre) => !ARTIST_GENRE_SET.has(genre))) {
    return { ok: false, error: "Choose genres from the list provided." };
  }
  const bio = text(input.bio, 4000);
  if (bio.length < BIO_MIN) {
    return { ok: false, error: `Write a short biography of at least ${BIO_MIN} characters.` };
  }
  const city = text(input.city, 60);
  const region = text(input.region, 40);
  if (region && !ARTIST_REGIONS.includes(region as (typeof ARTIST_REGIONS)[number])) {
    return { ok: false, error: "Select an operating region from the list." };
  }

  const media: ArtistMediaLink[] = [];
  for (const item of input.media || []) {
    const label = text(item.label, 40);
    const url = text(item.url, 300);
    if (!label && !url) continue;
    if (!label || !url) {
      return { ok: false, error: "Each media link needs a label and a URL." };
    }
    if (!validUrl(url)) {
      return { ok: false, error: `The link "${label}" must start with http:// or https://` };
    }
    media.push({ label, url });
  }
  if (media.length > MAX_ARTIST_MEDIA_LINKS) {
    return { ok: false, error: `Add up to ${MAX_ARTIST_MEDIA_LINKS} media links.` };
  }

  const links = {
    website: text(input.website, 300),
    instagram: text(input.instagram, 300),
    facebook: text(input.facebook, 300),
    x: text(input.x, 300),
    tiktok: text(input.tiktok, 300),
    youtube: text(input.youtube, 300),
  };
  for (const [name, value] of Object.entries(links)) {
    if (!validUrl(value)) {
      return { ok: false, error: `Your ${name} link must start with http:// or https://` };
    }
  }

  return {
    ok: true,
    value: {
      stageName,
      category,
      genres,
      bio,
      city,
      region,
      profileImage: text(input.profileImage, 300),
      coverImage: text(input.coverImage, 300),
      ...links,
      media,
      performanceHistory: text(input.performanceHistory, 2000),
      availabilityNote: text(input.availabilityNote, 500),
      bookingPrefs: text(input.bookingPrefs, 1000),
      technicalRider: text(input.technicalRider, 2000),
    },
  };
}

function slugBase(stageName: string) {
  const base = stageName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "artist";
}

function uniqueSlug(stageName: string) {
  const base = slugBase(stageName);
  let candidate = base;
  let suffix = 1;
  while (get<{ user_id: string }>("SELECT user_id FROM artist_profiles WHERE slug = ?", candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

export function getArtistProfile(userId: string): ArtistProfileWithUser | undefined {
  return get<ArtistProfileWithUser>(
    `SELECT ap.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
     FROM artist_profiles ap JOIN users u ON u.id = ap.user_id
     WHERE ap.user_id = ?`,
    userId,
  );
}

export function getArtistBySlug(slug: string): ArtistProfileWithUser | undefined {
  return get<ArtistProfileWithUser>(
    `SELECT ap.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
     FROM artist_profiles ap JOIN users u ON u.id = ap.user_id
     WHERE ap.slug = ?`,
    slug,
  );
}

export function getPublishedArtistBySlug(slug: string) {
  return get<ArtistProfileWithUser>(
    `SELECT ap.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
     FROM artist_profiles ap JOIN users u ON u.id = ap.user_id
     WHERE ap.slug = ? AND ap.visibility = 'published'`,
    slug,
  );
}

function likeValue(value: string) {
  return `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

export function listPublicArtists(filters: {
  query?: string;
  category?: string;
  city?: string;
}) {
  const clauses = ["ap.visibility = 'published'"];
  const params: string[] = [];
  const query = (filters.query || "").trim().slice(0, 60);
  if (query) {
    clauses.push(
      "(ap.stage_name LIKE ? ESCAPE '\\' OR ap.genres LIKE ? ESCAPE '\\' OR ap.bio LIKE ? ESCAPE '\\')",
    );
    const like = likeValue(query);
    params.push(like, like, like);
  }
  if (filters.category && ARTIST_CATEGORY_SET.has(filters.category)) {
    clauses.push("ap.category = ?");
    params.push(filters.category);
  }
  if (filters.city && (filters.city === "Nationwide" || ARTIST_REGIONS.includes(filters.city as (typeof ARTIST_REGIONS)[number]))) {
    clauses.push("ap.city = ?");
    params.push(filters.city);
  }
  return all<ArtistProfileWithUser>(
    `SELECT ap.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
     FROM artist_profiles ap JOIN users u ON u.id = ap.user_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY CASE ap.verification_status WHEN 'verified' THEN 0 ELSE 1 END, ap.stage_name ASC
     LIMIT 60`,
    ...params,
  );
}

export function listArtistProfiles(status?: string) {
  if (status && status !== "all") {
    return all<ArtistProfileWithUser>(
      `SELECT ap.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
       FROM artist_profiles ap JOIN users u ON u.id = ap.user_id
       WHERE ap.verification_status = ?
       ORDER BY ap.created_at DESC`,
      status,
    );
  }
  return all<ArtistProfileWithUser>(
    `SELECT ap.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
     FROM artist_profiles ap JOIN users u ON u.id = ap.user_id
     ORDER BY CASE ap.verification_status WHEN 'pending' THEN 0 WHEN 'requires_info' THEN 1 ELSE 2 END,
              ap.created_at DESC`,
  );
}

export function profileGaps(profile: Pick<
  ArtistProfile,
  "stage_name" | "category" | "bio" | "city" | "website" | "instagram" | "facebook" | "x" | "tiktok" | "youtube"
>): string[] {
  const gaps: string[] = [];
  if (profile.stage_name.trim().length < 2) gaps.push("Add your stage name");
  if (!profile.category) gaps.push("Choose your category");
  if (profile.bio.trim().length < BIO_PUBLISH_MIN) {
    gaps.push(`Write a biography of at least ${BIO_PUBLISH_MIN} characters`);
  }
  if (!profile.city) gaps.push("Add your base city");
  const links = [
    profile.website,
    profile.instagram,
    profile.facebook,
    profile.x,
    profile.tiktok,
    profile.youtube,
  ].filter(Boolean);
  if (!links.length) gaps.push("Add at least one link (website or social profile)");
  return gaps;
}

export function upsertArtistApplication(
  userId: string,
  input: ArtistProfileInput,
  actor: User,
) {
  if (actor.role !== "attendee" && actor.role !== "artist") {
    return {
      ok: false as const,
      error:
        "Artist accounts need a dedicated login. Contact support to split an organizer or staff account.",
    };
  }
  const existing = get<ArtistProfile>("SELECT * FROM artist_profiles WHERE user_id = ?", userId);
  const now = new Date().toISOString();
  const genres = input.genres.join(", ") || null;

  transaction((db) => {
    if (existing) {
      db.prepare(
        `UPDATE artist_profiles SET stage_name = ?, category = ?, genres = ?, bio = ?, city = ?,
                region = ?, updated_at = ?
         WHERE user_id = ?`,
      ).run(
        input.stageName,
        input.category,
        genres,
        input.bio,
        input.city || null,
        input.region || null,
        now,
        userId,
      );
    } else {
      db.prepare(
        `INSERT INTO artist_profiles (user_id, slug, stage_name, category, genres, bio, city,
                region, profile_image, cover_image, website, instagram, facebook, x, tiktok,
                youtube, media_json, performance_history, availability_note, booking_prefs,
                technical_rider, visibility, verification_status, accepting_bookings,
                created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'not_submitted', 1, ?, ?)`,
      ).run(
        userId,
        uniqueSlug(input.stageName),
        input.stageName,
        input.category,
        genres,
        input.bio,
        input.city || null,
        input.region || null,
        input.profileImage || null,
        input.coverImage || null,
        input.website || null,
        input.instagram || null,
        input.facebook || null,
        input.x || null,
        input.tiktok || null,
        input.youtube || null,
        input.media.length ? JSON.stringify(input.media) : null,
        input.performanceHistory || null,
        input.availabilityNote || null,
        input.bookingPrefs || null,
        input.technicalRider || null,
        now,
        now,
      );
    }
    if (actor.role === "attendee") {
      db.prepare("UPDATE users SET role = 'artist' WHERE id = ?").run(userId);
    }
  });

  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: existing ? "artist.profile_created_update" : "artist.profile_created",
    entityType: "artist",
    entityId: userId,
    after: { stageName: input.stageName, category: input.category },
  });
  return { ok: true as const };
}

export function updateArtistProfile(
  userId: string,
  input: ArtistProfileInput,
  actor: User,
) {
  const existing = get<ArtistProfile>("SELECT * FROM artist_profiles WHERE user_id = ?", userId);
  if (!existing) return { ok: false as const, error: "Create your artist profile first." };
  const now = new Date().toISOString();
  run(
    `UPDATE artist_profiles SET stage_name = ?, category = ?, genres = ?, bio = ?, city = ?,
            region = ?, profile_image = ?, cover_image = ?, website = ?, instagram = ?,
            facebook = ?, x = ?, tiktok = ?, youtube = ?, media_json = ?,
            performance_history = ?, availability_note = ?, booking_prefs = ?,
            technical_rider = ?, updated_at = ?
     WHERE user_id = ?`,
    input.stageName,
    input.category,
    input.genres.join(", ") || null,
    input.bio,
    input.city || null,
    input.region || null,
    input.profileImage || null,
    input.coverImage || null,
    input.website || null,
    input.instagram || null,
    input.facebook || null,
    input.x || null,
    input.tiktok || null,
    input.youtube || null,
    input.media.length ? JSON.stringify(input.media) : null,
    input.performanceHistory || null,
    input.availabilityNote || null,
    input.bookingPrefs || null,
    input.technicalRider || null,
    now,
    userId,
  );
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "artist.profile_updated",
    entityType: "artist",
    entityId: userId,
    after: { stageName: input.stageName, visibility: existing.visibility },
  });
  return { ok: true as const };
}

export function setArtistVisibility(
  userId: string,
  visibility: "published" | "draft",
  actor: User,
) {
  const existing = get<ArtistProfile>("SELECT * FROM artist_profiles WHERE user_id = ?", userId);
  if (!existing) return { ok: false as const, error: "Create your artist profile first." };
  if (visibility === "published") {
    const gaps = profileGaps(existing);
    if (gaps.length) {
      return {
        ok: false as const,
        error: `Before publishing: ${gaps.join(", ").toLowerCase()}.`,
      };
    }
  }
  run(
    "UPDATE artist_profiles SET visibility = ?, updated_at = ? WHERE user_id = ?",
    visibility,
    new Date().toISOString(),
    userId,
  );
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: visibility === "published" ? "artist.published" : "artist.unpublished",
    entityType: "artist",
    entityId: userId,
    before: { visibility: existing.visibility },
    after: { visibility },
  });
  return { ok: true as const };
}

export function listArtistVerificationHistory(artistId: string) {
  return all<ArtistVerificationRequest>(
    `SELECT * FROM artist_verification_requests WHERE artist_id = ?
     ORDER BY created_at DESC`,
    artistId,
  );
}

export function listArtistVerificationQueue(status?: string) {
  const clauses: string[] = [];
  const params: string[] = [];
  if (status && status !== "all") {
    clauses.push("avr.status = ?");
    params.push(status);
  } else if (!status) {
    clauses.push("avr.status = 'pending'");
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return all<ArtistVerificationWithArtist>(
    `SELECT avr.*, ap.stage_name, ap.slug, ap.category, ap.city, ap.bio, ap.visibility,
            u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
            (SELECT COUNT(*) FROM artist_documents ad WHERE ad.verification_id = avr.id) AS document_count
     FROM artist_verification_requests avr
     JOIN artist_profiles ap ON ap.user_id = avr.artist_id
     JOIN users u ON u.id = avr.artist_id
     ${where}
     ORDER BY avr.created_at DESC`,
    ...params,
  );
}

export function countPendingArtistVerifications() {
  const row = get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM artist_verification_requests WHERE status = 'pending'",
  );
  return Number(row?.count || 0);
}

export function countArtistDocuments(artistId: string) {
  const row = get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM artist_documents WHERE artist_id = ?",
    artistId,
  );
  return Number(row?.count || 0);
}

export function listArtistDocuments(artistId: string) {
  return all<ArtistDocument>(
    "SELECT * FROM artist_documents WHERE artist_id = ? ORDER BY uploaded_at DESC",
    artistId,
  );
}

export function listDocumentsForVerification(requestId: string) {
  return all<ArtistDocument>(
    "SELECT * FROM artist_documents WHERE verification_id = ? ORDER BY uploaded_at ASC",
    requestId,
  );
}

export function findArtistDocument(documentId: string) {
  return get<ArtistDocument>("SELECT * FROM artist_documents WHERE id = ?", documentId);
}

export function detectDocumentMime(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "application/pdf";
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}

export async function createArtistDocument(opts: {
  artistId: string;
  label: string;
  fileName: string;
  bytes: Uint8Array;
  actor: User;
}) {
  if (countArtistDocuments(opts.artistId) >= MAX_ARTIST_DOCUMENTS) {
    return {
      ok: false as const,
      error: `You can keep up to ${MAX_ARTIST_DOCUMENTS} documents. Remove one before uploading another.`,
    };
  }
  const mime = detectDocumentMime(opts.bytes);
  if (!mime) {
    return { ok: false as const, error: "Upload a PDF, JPEG or PNG file." };
  }
  const extension = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
  const id = randomId("adoc_");
  const storagePath = `artist-docs/${opts.artistId}/${id}.${extension}`;
  await savePrivateFile(storagePath, opts.bytes);
  try {
    run(
      `INSERT INTO artist_documents (id, artist_id, verification_id, label, file_name, mime,
              size, storage_path, sha256, uploaded_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      opts.artistId,
      opts.label,
      opts.fileName.slice(0, 120),
      mime,
      opts.bytes.length,
      storagePath,
      hashBytes(opts.bytes),
      new Date().toISOString(),
    );
  } catch (error) {
    await deletePrivateFile(storagePath);
    throw error;
  }
  writeAudit({
    actorId: opts.actor.id,
    actorName: opts.actor.name,
    actorRole: opts.actor.role,
    action: "artist.document_uploaded",
    entityType: "artist",
    entityId: opts.artistId,
    after: { documentId: id, label: opts.label, mime, size: opts.bytes.length },
  });
  return { ok: true as const, documentId: id };
}

export async function removeArtistDocument(
  artistId: string,
  documentId: string,
  actor: User,
) {
  const doc = findArtistDocument(documentId);
  if (!doc || doc.artist_id !== artistId) {
    return { ok: false as const, error: "Document not found." };
  }
  if (doc.verification_id) {
    return {
      ok: false as const,
      error: "This document is part of a submitted verification request and cannot be removed.",
    };
  }
  run("DELETE FROM artist_documents WHERE id = ?", documentId);
  await deletePrivateFile(doc.storage_path);
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "artist.document_removed",
    entityType: "artist",
    entityId: artistId,
    before: { documentId, label: doc.label },
  });
  return { ok: true as const };
}

export function submitArtistVerification(
  artistId: string,
  opts: { note: string; documentIds: string[]; actor: User },
) {
  const profile = get<ArtistProfile>("SELECT * FROM artist_profiles WHERE user_id = ?", artistId);
  if (!profile) return { ok: false as const, error: "Create your artist profile first." };
  if (profile.verification_status === "verified") {
    return { ok: false as const, error: "Your artist identity is already verified." };
  }
  if (profile.verification_status === "pending") {
    return { ok: false as const, error: "Your verification is already under review." };
  }
  const docs = opts.documentIds.length
    ? all<ArtistDocument>(
        `SELECT * FROM artist_documents
         WHERE artist_id = ? AND verification_id IS NULL AND id IN (${opts.documentIds
          .map(() => "?")
          .join(", ")})`,
        artistId,
        ...opts.documentIds,
      )
    : [];
  if (!docs.length) {
    return {
      ok: false as const,
      error: "Upload at least one identity document before requesting verification.",
    };
  }
  if (docs.length !== opts.documentIds.length) {
    return {
      ok: false as const,
      error:
        "Some selected documents were already submitted with an earlier request. Upload fresh copies or choose unused documents.",
    };
  }

  const requestId = randomId("aver_");
  const now = new Date().toISOString();
  transaction((db) => {
    db.prepare(
      `INSERT INTO artist_verification_requests (id, artist_id, status, note, decision_note,
              reviewed_by, reviewed_at, created_at)
       VALUES (?, ?, 'pending', ?, NULL, NULL, NULL, ?)`,
    ).run(requestId, artistId, opts.note || null, now);
    const attach = db.prepare(
      "UPDATE artist_documents SET verification_id = ? WHERE id = ? AND artist_id = ?",
    );
    for (const doc of docs) attach.run(requestId, doc.id, artistId);
    db.prepare(
      "UPDATE artist_profiles SET verification_status = 'pending', updated_at = ? WHERE user_id = ?",
    ).run(now, artistId);
  });
  writeAudit({
    actorId: opts.actor.id,
    actorName: opts.actor.name,
    actorRole: opts.actor.role,
    action: "artist.verification_submitted",
    entityType: "artist",
    entityId: artistId,
    before: { verification_status: profile.verification_status },
    after: { verification_status: "pending", requestId, documents: docs.length },
  });
  return { ok: true as const, requestId };
}

export function decideArtistVerification(
  requestId: string,
  decision: "verified" | "requires_info" | "rejected",
  note: string,
  actor: User,
  ip?: string | null,
) {
  const request = get<ArtistVerificationRequest>(
    "SELECT * FROM artist_verification_requests WHERE id = ?",
    requestId,
  );
  if (!request) return { ok: false as const, error: "Verification request not found." };
  if (request.status !== "pending") {
    return { ok: false as const, error: "This request has already been decided." };
  }
  const documentCount = get<{ count: number }>(
    "SELECT COUNT(*) AS count FROM artist_documents WHERE verification_id = ?",
    requestId,
  );
  if (decision === "verified" && Number(documentCount?.count || 0) < 1) {
    return {
      ok: false as const,
      error: "Attach at least one identity document before marking this artist verified.",
    };
  }
  if (decision !== "verified" && !note.trim()) {
    return { ok: false as const, error: "Add a note explaining the decision." };
  }
  const reviewedAt = new Date().toISOString();
  const nextStatus: ArtistVerificationStatus = decision;
  transaction((db) => {
    db.prepare(
      `UPDATE artist_verification_requests SET status = ?, decision_note = ?, reviewed_by = ?,
              reviewed_at = ? WHERE id = ?`,
    ).run(decision, note.trim() || null, actor.id, reviewedAt, requestId);
    db.prepare(
      "UPDATE artist_profiles SET verification_status = ?, updated_at = ? WHERE user_id = ?",
    ).run(nextStatus, reviewedAt, request.artist_id);
  });
  writeAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: `artist.verification_${decision}`,
    entityType: "artist",
    entityId: request.artist_id,
    before: { status: request.status },
    after: { status: decision, note: note.trim() || null, requestId },
    ip,
  });
  return { ok: true as const };
}

export const ARTIST_CATEGORY_CHOICES = ARTIST_CATEGORIES;
export const ARTIST_GENRE_CHOICES = ARTIST_GENRES;
