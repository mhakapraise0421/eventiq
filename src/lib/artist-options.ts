export const ARTIST_CATEGORIES = [
  "Musician",
  "DJ",
  "Band",
  "Comedian",
  "MC / Host",
  "Dancer",
  "Poet",
  "Other",
] as const;

export const ARTIST_GENRES = [
  "Afrobeats",
  "Amapiano",
  "Sungura",
  "Chimurenga",
  "Zimdancehall",
  "Gospel",
  "Jazz",
  "Hip hop",
  "R&B",
  "House",
  "Dancehall",
  "Reggae",
  "Traditional",
  "Comedy",
  "Spoken word",
] as const;

export const ARTIST_REGIONS = [
  "Harare",
  "Bulawayo",
  "Victoria Falls",
  "Mutare",
  "Gweru",
  "Masvingo",
  "Nationwide",
  "International",
] as const;

export const MAX_ARTIST_GENRES = 6;
export const MAX_ARTIST_MEDIA_LINKS = 6;
export const MAX_ARTIST_DOCUMENTS = 4;
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export const ARTIST_CATEGORY_SET = new Set<string>(ARTIST_CATEGORIES);
export const ARTIST_GENRE_SET = new Set<string>(ARTIST_GENRES);
