import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  ExternalLink,
  Link2,
  ListMusic,
  MapPin,
  Mic,
} from "lucide-react";
import { getPublishedArtistBySlug, parseGenres, parseMedia } from "@/lib/artists";
import { getCurrentUser } from "@/lib/auth";
import { getOrganizerProfile } from "@/lib/admin";
import { listOrganizerBookableEvents } from "@/lib/bookings";
import { BookingRequestForm } from "@/components/booking-request-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artist = getPublishedArtistBySlug(slug);
  if (!artist) return { title: "Artist not found" };
  return {
    title: `${artist.stage_name} · Artist`,
    description: artist.bio.slice(0, 155),
  };
}

export default async function ArtistPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artist = getPublishedArtistBySlug(slug);
  if (!artist) notFound();

  const genres = parseGenres(artist);
  const media = parseMedia(artist);
  const viewer = await getCurrentUser();
  const viewerOrganizer = viewer?.role === "organizer" ? getOrganizerProfile(viewer.id) : undefined;
  const canRequest = !!viewer && viewerOrganizer?.status === "approved";
  const bookableEvents = canRequest && viewer ? listOrganizerBookableEvents(viewer.id) : [];
  const socials = [
    ["Website", artist.website],
    ["Instagram", artist.instagram],
    ["Facebook", artist.facebook],
    ["X / Twitter", artist.x],
    ["TikTok", artist.tiktok],
    ["YouTube", artist.youtube],
  ].filter((entry): entry is [string, string] => !!entry[1]);
  const initials = artist.stage_name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-[70vh] pb-16">
      <section className="relative h-[220px] overflow-hidden bg-gradient-to-br from-ink-950 via-brand-900 to-aqua-400/50 md:h-[260px]">
        {artist.cover_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artist.cover_image} alt="" className="h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
        <div className="container-page absolute inset-x-0 bottom-4">
          <Link
            href="/artists"
            className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5 text-[11.5px] font-semibold text-white backdrop-blur hover:bg-black/50"
          >
            <ArrowLeft className="h-3 w-3" /> Artist directory
          </Link>
        </div>
      </section>

      <div className="container-page max-w-4xl">
        <div className="-mt-12 flex flex-wrap items-end gap-4">
          <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border-4 border-white bg-ink-950 font-display text-[28px] font-semibold text-white shadow-lg">
            {artist.profile_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={artist.profile_image}
                alt={artist.stage_name}
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </span>
          <div className="pb-1">
            <h1 className="flex flex-wrap items-center gap-2 font-display text-[28px] font-semibold tracking-[-0.035em] text-ink-950">
              {artist.stage_name}
              {artist.verification_status === "verified" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                  <BadgeCheck className="h-3 w-3" /> Verified artist
                </span>
              ) : null}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-500">
              <span className="inline-flex items-center gap-1">
                <Mic className="h-3.5 w-3.5 text-ink-400" /> {artist.category}
              </span>
              {artist.city ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-ink-400" /> {artist.city}
                  {artist.region && artist.region !== artist.city ? ` · ${artist.region}` : ""}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="font-display text-[15px] font-semibold tracking-[-0.02em]">
                About
              </h2>
              <div className="mt-2 space-y-3 text-[12.5px] leading-relaxed text-ink-600">
                {artist.bio.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
              {genres.length ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {genres.map((genre) => (
                    <span
                      key={genre}
                      className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>

            {artist.performance_history ? (
              <section className="rounded-2xl border border-line bg-white p-5">
                <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
                  <ListMusic className="h-4 w-4 text-brand-600" /> Performance history
                </h2>
                <p className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-ink-600">
                  {artist.performance_history}
                </p>
              </section>
            ) : null}

            {artist.technical_rider ? (
              <details className="rounded-2xl border border-line bg-white p-5">
                <summary className="cursor-pointer list-none font-display text-[15px] font-semibold tracking-[-0.02em]">
                  Technical rider
                </summary>
                <p className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-ink-600">
                  {artist.technical_rider}
                </p>
              </details>
            ) : null}
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="font-display text-[14px] font-semibold tracking-[-0.02em]">
                Links
              </h2>
              {socials.length ? (
                <ul className="mt-2 space-y-1.5">
                  {socials.map(([label, url]) => (
                    <li key={label}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium text-ink-600 hover:bg-surface"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Link2 className="h-3.5 w-3.5 text-ink-400" /> {label}
                        </span>
                        <ExternalLink className="h-3 w-3 text-ink-300" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] text-ink-400">No links shared yet.</p>
              )}

              {media.length ? (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-400">
                    Listen / watch
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {media.map((item) => (
                      <li key={`${item.label}-${item.url}`}>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] font-semibold text-brand-700 hover:underline"
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            {artist.availability_note ? (
              <section className="rounded-2xl border border-line bg-white p-5">
                <h2 className="flex items-center gap-2 font-display text-[14px] font-semibold tracking-[-0.02em]">
                  <CalendarClock className="h-4 w-4 text-brand-600" /> Availability
                </h2>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-600">
                  {artist.availability_note}
                </p>
              </section>
            ) : null}

            <section className="rounded-2xl border border-brand-200 bg-brand-50/70 p-5">
              <h2 className="font-display text-[14px] font-semibold tracking-[-0.02em] text-brand-900">
                Booking requests
              </h2>
              {artist.accepting_bookings ? (
                <>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-brand-900/70">
                    {canRequest
                      ? "Send a request tied to one of your upcoming events. The artist accepts or declines from their calendar."
                      : viewer?.id === artist.user_id
                        ? "This is your public booking card. Review incoming requests from your console."
                        : "Approved organizers can request this artist for one of their events."}
                  </p>

                  {viewer?.id === artist.user_id ? (
                    <Link href="/artist/bookings" className="btn btn-outline btn-sm mt-3">
                      Open booking requests
                    </Link>
                  ) : canRequest ? (
                    <div className="mt-3">
                      <BookingRequestForm
                        artist={{
                          id: artist.user_id,
                          stageName: artist.stage_name,
                          verified: artist.verification_status === "verified",
                        }}
                        events={bookableEvents}
                      />
                    </div>
                  ) : viewer ? (
                    viewer.role === "organizer" ? (
                      <Link href="/organizer/apply" className="btn btn-outline btn-sm mt-3">
                        Complete organizer application
                      </Link>
                    ) : (
                      <p className="mt-3 text-[10.5px] leading-relaxed text-brand-900/60">
                        Booking requests are available to approved organizer accounts.{" "}
                        <Link href="/organizer/apply" className="font-semibold underline">
                          Apply to become an organizer
                        </Link>
                        .
                      </p>
                    )
                  ) : (
                    <Link
                      href={`/login?next=${encodeURIComponent(`/artists/${artist.slug}`)}`}
                      className="btn btn-outline btn-sm mt-3"
                    >
                      Sign in as an organizer
                    </Link>
                  )}
                </>
              ) : (
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-brand-900/70">
                  This artist has paused booking requests for now. Check back later or reach out
                  through the links above.
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
