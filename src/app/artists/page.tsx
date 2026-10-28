import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, MapPin, Mic, Search, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listPublicArtists, parseGenres } from "@/lib/artists";
import { ARTIST_CATEGORIES } from "@/lib/artist-options";
import { CITIES } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Artist directory",
  description:
    "Discover musicians, DJs, bands, comedians and performers available for events across Zimbabwe.",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function ArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; city?: string }>;
}) {
  const { q = "", category = "", city = "" } = await searchParams;
  const user = await getCurrentUser();
  const artists = listPublicArtists({ query: q, category, city });
  const filtered = !!(q || category || city);

  return (
    <div className="min-h-[70vh] pb-16">
      <section className="border-b border-line bg-gradient-to-br from-ink-950 via-ink-900 to-brand-900 pb-10 pt-12 text-white">
        <div className="container-page">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-aqua-400">
            EventIQ artists
          </p>
          <h1 className="mt-2 max-w-2xl font-display text-[32px] font-semibold leading-tight tracking-[-0.035em] md:text-[42px]">
            Book talent that fits your <span className="text-aqua-400">stage.</span>
          </h1>
          <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-white/60">
            Musicians, DJs, bands, comedians and hosts building professional profiles on EventIQ.
            Verified artists have had their identity reviewed by our team.
          </p>

          <form
            method="get"
            action="/artists"
            className="mt-6 grid gap-2 rounded-2xl border border-white/10 bg-white/95 p-2 shadow-lg sm:grid-cols-[1.4fr_1fr_1fr_auto]"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search by name, genre or act"
                className="input h-10 border-line pl-9 text-[13px]"
                aria-label="Search artists"
              />
            </div>
            <select name="category" defaultValue={category} className="input h-10 text-[13px]" aria-label="Category">
              <option value="">All categories</option>
              {ARTIST_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select name="city" defaultValue={city} className="input h-10 text-[13px]" aria-label="City">
              <option value="">All cities</option>
              {CITIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary h-10">
              Search
            </button>
          </form>
        </div>
      </section>

      <div className="container-page pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] text-ink-500">
            <strong className="text-ink-950">{artists.length}</strong>{" "}
            {artists.length === 1 ? "artist" : "artists"}
            {filtered ? " match your filters" : " in the directory"}
          </p>
          {!user ? (
            <Link href="/register" className="btn btn-outline btn-sm">
              <Mic className="h-3.5 w-3.5" /> Join as an artist
            </Link>
          ) : user.role === "attendee" ? (
            <Link href="/artist/apply" className="btn btn-outline btn-sm">
              <Mic className="h-3.5 w-3.5" /> Create your artist profile
            </Link>
          ) : null}
        </div>

        {artists.length ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {artists.map((artist) => {
              const genres = parseGenres(artist);
              return (
                <Link
                  key={artist.user_id}
                  href={`/artists/${artist.slug}`}
                  className="group overflow-hidden rounded-2xl border border-line bg-white transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(8,8,13,0.08)]"
                >
                  <div className="relative h-32 bg-gradient-to-br from-brand-200 via-brand-100 to-aqua-300/40">
                    {artist.cover_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={artist.cover_image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                    {artist.verification_status === "verified" ? (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shadow-sm">
                        <BadgeCheck className="h-3 w-3" /> Verified
                      </span>
                    ) : null}
                  </div>
                  <div className="px-4 pb-4">
                    <span className="-mt-8 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-ink-950 font-display text-[18px] font-semibold text-white shadow-sm">
                      {artist.profile_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={artist.profile_image}
                          alt={artist.stage_name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials(artist.stage_name)
                      )}
                    </span>
                    <h2 className="mt-2 font-display text-[17px] font-semibold tracking-[-0.02em] text-ink-950">
                      {artist.stage_name}
                    </h2>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-400">
                      <span>{artist.category}</span>
                      {artist.city ? (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" /> {artist.city}
                        </span>
                      ) : null}
                    </p>
                    {genres.length ? (
                      <p className="mt-2 line-clamp-1 text-[11px] text-ink-500">
                        {genres.slice(0, 3).join(" · ")}
                      </p>
                    ) : null}
                    <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-ink-500">
                      {artist.bio}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              icon={<Sparkles className="h-5 w-5" />}
              title={filtered ? "No artists match those filters" : "The directory is just starting"}
              description={
                filtered
                  ? "Try a different genre, city or spelling. New profiles appear once artists publish them."
                  : "Published artist profiles will appear here as artists join EventIQ."
              }
            />
          </div>
        )}

        <div className="mt-10 flex flex-col items-start justify-between gap-3 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-[15px] font-semibold tracking-[-0.02em] text-ink-950">
              Are you a performer?
            </p>
            <p className="mt-1 text-[11.5px] text-ink-500">
              Create a profile for free. Publishing and verification are separate, and verification
              is reviewed by a person.
            </p>
          </div>
          <Link href="/artist/apply" className="btn btn-primary btn-sm">
            <Mic className="h-3.5 w-3.5" /> Create an artist profile
          </Link>
        </div>
      </div>
    </div>
  );
}
