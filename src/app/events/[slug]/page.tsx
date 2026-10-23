import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Clock,
  Info,
  MapPin,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import {
  listFavoriteEventIds,
  recordEventView,
} from "@/lib/attendee";
import {
  getEventBySlug,
  getTicketTypes,
  listPublicEvents,
} from "@/lib/events";
import {
  formatDate,
  formatDateShort,
  formatDayParts,
  formatMoney,
  formatTimeRange,
} from "@/lib/format";
import { TicketSelector } from "@/components/ticket-selector";
import { EventCard } from "@/components/event-card";
import { FavoriteButton } from "@/components/favorite-button";
import { ShareButton } from "@/components/share-button";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) return { title: "Event not found" };
  return {
    title: event.title,
    description: event.tagline || event.description.slice(0, 155),
    openGraph: {
      title: event.title,
      description: event.tagline || event.description.slice(0, 155),
      images: event.cover_image ? [event.cover_image] : [],
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) notFound();

  const user = await getCurrentUser();
  if (user && event.status === "approved") {
    recordEventView(user.id, event.id);
  }
  const favoriteSet = new Set(user ? listFavoriteEventIds(user.id) : []);
  const favorited = favoriteSet.has(event.id);
  const canPreview =
    !!user &&
    (user.id === event.organizer_id ||
      user.role === "admin" ||
      user.role === "ceo");

  if (event.status !== "approved" && event.status !== "completed" && !canPreview) {
    notFound();
  }

  const tiers = getTicketTypes(event.id);
  const date = formatDayParts(event.starts_at);
  const salesClosed =
    event.status !== "approved" ||
    new Date(event.starts_at).getTime() < Date.now() ||
    tiers.every((t) => t.sales_end && new Date(t.sales_end) < new Date());

  const related = listPublicEvents({ category: event.category })
    .filter((e) => e.id !== event.id)
    .slice(0, 3);

  return (
    <div>
      <div className="container-page pt-5">
        <nav className="flex items-center gap-1.5 text-[11.5px] text-ink-400">
          <Link href="/" className="hover:text-ink-700">Home</Link>
          <span>/</span>
          <Link href="/events" className="hover:text-ink-700">Events</Link>
          <span>/</span>
          <span className="truncate text-ink-600">{event.title}</span>
        </nav>

        {event.status !== "approved" && event.status !== "completed" ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">
            <Info className="h-3.5 w-3.5" />
            Preview mode — this event is <strong>{event.status}</strong> and is not visible to
            the public.
            <StatusBadge status={event.status} />
          </div>
        ) : null}

        <div className="mt-5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/events?category=${encodeURIComponent(event.category)}`}
              className="badge bg-brand-50 text-brand-700"
            >
              {event.category}
            </Link>
            <span className="badge bg-surface text-ink-500">{event.city}</span>
            {event.age_limit ? (
              <span className="badge bg-surface text-ink-500">{event.age_limit}</span>
            ) : null}
          </div>
          <h1 className="mt-3 font-display text-[32px] font-semibold leading-[1.08] tracking-[-0.04em] text-ink-950 md:text-[44px]">
            {event.title}
          </h1>
          {event.tagline ? (
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-500">
              {event.tagline}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <FavoriteButton
              eventId={event.id}
              initialFavorited={favorited}
              isAuthenticated={!!user}
              variant="pill"
            />
            <ShareButton title={event.title} url={`/events/${event.slug}`} />
          </div>
        </div>

        <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-2xl bg-gradient-to-br from-brand-100 via-surface to-aqua-300/30 md:aspect-[21/9]">
          {event.cover_image ? (
            <Image
              src={event.cover_image}
              alt={event.title}
              fill
              unoptimized
              priority
              sizes="100vw"
              className="object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-4 md:inset-x-6 md:bottom-6">
            <div className="flex items-end gap-3">
              <div className="flex flex-col items-center rounded-xl bg-white px-3.5 py-2.5 text-center shadow-lg">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                  {date.month}
                </span>
                <span className="font-display text-[24px] font-semibold leading-none">
                  {date.day}
                </span>
                <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-400">
                  {date.weekday}
                </span>
              </div>
              <div className="pb-0.5 text-white">
                <p className="text-[12.5px] font-semibold">
                  {formatDate(event.starts_at)}
                </p>
                <p className="mt-0.5 text-[11.5px] text-white/70">
                  {formatTimeRange(event.starts_at, event.ends_at)} · CAT
                </p>
                <p className="mt-1 flex items-center gap-1 text-[11.5px] text-white/70">
                  <MapPin className="h-3 w-3" /> {event.venue}, {event.city}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-[10.5px] font-semibold text-white backdrop-blur">
              {tiers.reduce((sum, t) => sum + Math.max(0, t.capacity - t.sold), 0)} tickets
              available
            </span>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
          <div>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface/40 px-4 py-3 text-[12px] text-ink-600">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-brand-600" />
                {formatDateShort(event.starts_at)} – {formatDateShort(event.ends_at)}
              </span>
              <span className="hidden h-3 w-px bg-line sm:block" />
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-brand-600" />
                {formatTimeRange(event.starts_at, event.ends_at)}
              </span>
              <span className="hidden h-3 w-px bg-line sm:block" />
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-brand-600" />
                {event.age_limit || "All ages"}
              </span>
            </div>

            <section className="mt-8">
              <h2 className="font-display text-[20px] font-semibold tracking-[-0.025em] text-ink-950">
                About this event
              </h2>
              <div className="mt-3 space-y-4 text-[13.5px] leading-[1.75] text-ink-600">
                {event.description.split("\n\n").map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="font-display text-[20px] font-semibold tracking-[-0.025em] text-ink-950">
                {event.category === "Conferences" ? "What's included" : "Good to know"}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    icon: Ticket,
                    label: "Ticket delivery",
                    value: "QR ticket issued instantly to your EventIQ account after payment.",
                  },
                  {
                    icon: Clock,
                    label: "Doors",
                    value: `${formatTimeRange(event.starts_at, event.ends_at)} (Central Africa Time).`,
                  },
                  {
                    icon: ShieldCheck,
                    label: "Entry policy",
                    value: "Each ticket is valid for one admission. Duplicate scans are rejected.",
                  },
                  {
                    icon: Users,
                    label: "Capacity",
                    value: `${event.total_capacity || 0} tickets across ${event.tier_count || 0} tiers.`,
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-line bg-white p-3.5">
                    <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-900">
                      <item.icon className="h-3.5 w-3.5 text-brand-600" /> {item.label}
                    </p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="font-display text-[20px] font-semibold tracking-[-0.025em] text-ink-950">
                Venue
              </h2>
              <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
                <div className="relative h-36 w-full bg-gradient-to-br from-brand-100 via-surface to-aqua-300/40">
                  <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(#d9d5e6_1px,transparent_1px),linear-gradient(90deg,#d9d5e6_1px,transparent_1px)] [background-size:28px_28px]" />
                  <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg">
                    <MapPin className="h-4 w-4" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-[13px] font-semibold text-ink-950">{event.venue}</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-400">
                      {event.address || event.city}, Zimbabwe
                    </p>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${event.venue}, ${event.city}, Zimbabwe`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    Open map
                  </a>
                </div>
              </div>
            </section>

            <section className="mt-8">
              <h2 className="font-display text-[20px] font-semibold tracking-[-0.025em] text-ink-950">
                Organizer
              </h2>
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-white p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 font-display text-[16px] font-semibold text-brand-700">
                  {(event.organizer_business || event.organizer_name || "EV")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-950">
                    {event.organizer_business || event.organizer_name}
                    <BadgeCheck className="h-3.5 w-3.5 text-brand-600" />
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-ink-400">
                    Verified EventIQ organizer · {event.organizer_name}
                  </p>
                </div>
              </div>
            </section>

            <details className="mt-6 rounded-xl border border-line bg-surface/40 px-4 py-3">
              <summary className="cursor-pointer list-none text-[12.5px] font-semibold text-ink-900">
                Ticket terms & entry conditions
              </summary>
              <p className="mt-2 text-[11.5px] leading-relaxed text-ink-500">
                {event.terms ||
                  "Tickets are non-transferable unless approved by EventIQ support. Entry may be refused without a valid ticket or appropriate ID. Refunds follow the EventIQ refund policy."}
              </p>
            </details>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <TicketSelector
              eventId={event.id}
              eventSlug={event.slug}
              tiers={tiers}
              isAuthenticated={!!user}
              salesClosed={salesClosed}
            />
            <div className="mt-3 rounded-xl border border-line bg-surface/50 px-4 py-3 text-[11px] leading-relaxed text-ink-400">
              <p className="font-semibold text-ink-600">Payment & fees</p>
              <p className="mt-1">
                A 5% service fee is added at checkout and shown before you pay. Organizer
                settlement and commission are handled separately.
              </p>
            </div>
          </aside>
        </div>

        {related.length ? (
          <section className="mt-16">
            <div className="flex items-end justify-between">
              <h2 className="font-display text-[22px] font-semibold tracking-[-0.03em]">
                More {event.category.toLowerCase()} events
              </h2>
              <Link
                href={`/events?category=${encodeURIComponent(event.category)}`}
                className="flex items-center gap-1 text-[12.5px] font-semibold text-brand-700"
              >
                <ArrowLeft className="h-3.5 w-3.5 rotate-180" /> See all
              </Link>
            </div>
            <div className="mt-5 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <EventCard
                  key={item.id}
                  event={item}
                  favorite={{ favorited: favoriteSet.has(item.id), authenticated: !!user }}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
