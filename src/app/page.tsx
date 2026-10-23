import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  CalendarDays,
  Church,
  Crown,
  GraduationCap,
  Heart,
  MapPin,
  Mic2,
  Music2,
  PartyPopper,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { EventCard } from "@/components/event-card";
import {
  getCategoryCounts,
  getPublicEventStats,
  listFeaturedEvents,
  listUpcomingEvents,
  listWeekendEvents,
} from "@/lib/events";
import {
  CATEGORIES,
  formatDate,
  formatDayParts,
  formatMoney,
  formatTime,
} from "@/lib/format";

export const dynamic = "force-dynamic";

const HERO_IMAGE = "/images/hero-crowd.png";

const categoryIcons: Record<string, typeof Music2> = {
  Concerts: Music2,
  Festivals: PartyPopper,
  Nightlife: Sparkles,
  Parties: Users,
  "Weddings & Roora": Heart,
  Church: Church,
  School: GraduationCap,
  Proms: Crown,
  Comedy: Mic2,
  Sports: Trophy,
  Conferences: Briefcase,
  Corporate: Briefcase,
  Other: CalendarDays,
};

const VIBE_CATEGORIES = [
  {
    category: "Concerts",
    image: "/images/vibe-concerts.png",
    blurb: "Live shows & big stages",
  },
  {
    category: "Nightlife",
    image: "/images/vibe-nightlife.png",
    blurb: "Club nights & late sessions",
  },
  {
    category: "Church",
    image: "/images/vibe-gospel.png",
    blurb: "Gospel, worship & choirs",
  },
  {
    category: "Weddings & Roora",
    image: "/images/vibe-roora.png",
    blurb: "Celebrate the big day",
  },
];

const VIBE_SET = new Set(VIBE_CATEGORIES.map((vibe) => vibe.category));

export default function HomePage() {
  const featured = listFeaturedEvents(3);
  const featuredIds = new Set(featured.map((e) => e.id));
  const upcoming = listUpcomingEvents(9)
    .filter((e) => !featuredIds.has(e.id))
    .slice(0, 6);
  const categories = getCategoryCounts();
  const stats = getPublicEventStats();
  const weekend = listWeekendEvents(5);
  const heroEvent = featured[0];
  const categoryCount = new Map(categories.map((c) => [c.category, c.count]));
  const moreCategories = CATEGORIES.filter(
    (category) => !VIBE_SET.has(category) && (categoryCount.get(category) || 0) > 0,
  );

  return (
    <div>
      <section className="container-page pt-5">
        <div className="relative overflow-hidden rounded-[26px] bg-ink-950">
          <Image
            src={HERO_IMAGE}
            alt="Crowd under purple concert lights"
            fill
            unoptimized
            priority
            sizes="100vw"
            className="object-cover opacity-[0.42]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/90 to-ink-950/30" />
          <div className="absolute inset-0 grain opacity-40" />

          <div className="relative grid gap-10 px-6 py-10 md:grid-cols-[1.05fr_0.95fr] md:items-center md:px-11 md:py-14 lg:gap-16">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/80 backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aqua-400 opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-aqua-400" />
                </span>
                Live events across Zimbabwe
              </div>

              <h1 className="mt-5 max-w-[15ch] font-display text-[38px] font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-[50px] md:text-[54px]">
                Your next great night starts here.
              </h1>
              <p className="mt-4 max-w-md text-[14px] leading-relaxed text-white/60">
                Discover concerts, festivals, nightlife and conferences. Secure your
                ticket in minutes and get in with a single scan.
              </p>

              <form
                action="/events"
                className="mt-7 flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)] sm:flex-row sm:items-center"
              >
                <div className="flex flex-1 items-center gap-2.5 px-2.5">
                  <Search className="h-4 w-4 shrink-0 text-ink-300" />
                  <input
                    name="q"
                    placeholder="Search events, artists or venues"
                    aria-label="Search events"
                    className="h-10 w-full border-0 bg-transparent text-[13.5px] text-ink-900 outline-none placeholder:text-ink-300"
                  />
                </div>
                <div className="hidden h-7 w-px bg-line sm:block" />
                <select
                  name="city"
                  aria-label="City"
                  className="h-10 rounded-lg bg-transparent px-2.5 text-[13px] font-medium text-ink-600 outline-none"
                  defaultValue=""
                >
                  <option value="">All cities</option>
                  <option>Harare</option>
                  <option>Bulawayo</option>
                  <option>Victoria Falls</option>
                  <option>Mutare</option>
                  <option>Gweru</option>
                </select>
                <button type="submit" className="btn btn-primary">
                  Find tickets
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] font-medium text-white/50">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-aqua-400" /> Verified organizers
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-aqua-400" /> Instant ticket delivery
                </span>
                <span className="flex items-center gap-1.5">
                  <ScanLine className="h-3.5 w-3.5 text-aqua-400" /> QR gate entry
                </span>
              </div>
            </div>

            {heroEvent ? (
              <Link
                href={`/events/${heroEvent.slug}`}
                className="group hidden overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07] p-2.5 backdrop-blur-md md:block"
              >
                <div className="relative aspect-[16/10] overflow-hidden rounded-xl">
                  {heroEvent.cover_image ? (
                    <Image
                      src={heroEvent.cover_image}
                      alt={heroEvent.title}
                      fill
                      unoptimized
                      sizes="(max-width: 1024px) 40vw, 440px"
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                    Featured
                  </span>
                  <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3 text-white">
                    <div>
                      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-white/60">
                        {heroEvent.category}
                      </p>
                      <p className="font-display text-[16px] font-semibold leading-tight">
                        {heroEvent.title}
                      </p>
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-ink-950 transition group-hover:bg-aqua-400">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between px-2 pb-1 pt-3 text-white/75">
                  <div className="flex items-center gap-1.5 text-[11.5px]">
                    <CalendarDays className="h-3.5 w-3.5 text-white/40" />
                    {formatDate(heroEvent.starts_at)} · {formatTime(heroEvent.starts_at)}
                  </div>
                  <p className="text-[12px] font-semibold text-white">
                    {heroEvent.min_price_cents === 0
                      ? "Free"
                      : `From ${formatMoney(heroEvent.min_price_cents || 0)}`}
                  </p>
                </div>
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="container-page mt-10">
        <div className="grid gap-4 rounded-2xl border border-line bg-surface/50 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Ticket,
              title: `${stats.events} live events`,
              text: "Across Harare, Bulawayo, Victoria Falls and beyond",
            },
            {
              icon: ShieldCheck,
              title: "Verified organizers",
              text: "Every organizer is reviewed before publishing",
            },
            {
              icon: ScanLine,
              title: "Single-scan entry",
              text: "Duplicate scans are rejected server-side",
            },
            {
              icon: Zap,
              title: "Instant delivery",
              text: "Your QR ticket is ready the moment payment clears",
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 ring-1 ring-line">
                <item.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-ink-950">{item.title}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-400">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {weekend.length > 0 ? (
        <section className="container-page mt-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">This weekend</p>
              <h2 className="mt-2 font-display text-[26px] font-semibold tracking-[-0.035em] text-ink-950 md:text-[32px]">
                Don&apos;t let the weekend sneak up on you
              </h2>
            </div>
            <Link
              href="/events?date=week"
              className="hidden items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:text-brand-800 sm:flex"
            >
              Full weekend lineup <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {weekend.map((event) => {
              const parts = formatDayParts(event.starts_at);
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.slug}`}
                  className="group flex items-center gap-3.5 px-4 py-3 transition hover:bg-brand-50/50 sm:gap-4 sm:px-5"
                >
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                    <span className="text-[9px] font-bold uppercase tracking-wider">
                      {parts.weekday}
                    </span>
                    <span className="font-display text-[17px] font-semibold leading-none">
                      {parts.day}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-brand-600">
                      {event.category} · {parts.month}
                    </p>
                    <p className="mt-0.5 truncate font-display text-[14.5px] font-semibold text-ink-950">
                      {event.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-ink-400">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {event.venue}, {event.city} · {formatTime(event.starts_at)}
                    </p>
                  </div>
                  <p className="shrink-0 text-[12.5px] font-semibold text-ink-900">
                    {event.min_price_cents === 0
                      ? "Free"
                      : `From ${formatMoney(event.min_price_cents || 0)}`}
                  </p>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:-translate-y-0.5 group-hover:text-brand-600" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="container-page mt-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Curated for you</p>
            <h2 className="mt-2 font-display text-[26px] font-semibold tracking-[-0.035em] text-ink-950 md:text-[32px]">
              Featured this week
            </h2>
          </div>
          <Link
            href="/events"
            className="hidden items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:text-brand-800 sm:flex"
          >
            View all events <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((event, index) => (
            <EventCard key={event.id} event={event} priority={index === 0} />
          ))}
        </div>
      </section>

      <section className="container-page mt-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Pick a vibe</p>
            <h2 className="mt-2 font-display text-[26px] font-semibold tracking-[-0.035em] text-ink-950 md:text-[32px]">
              What are you in the mood for?
            </h2>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VIBE_CATEGORIES.map((vibe) => {
            const count = categoryCount.get(vibe.category) || 0;
            return (
              <Link
                key={vibe.category}
                href={`/events?category=${encodeURIComponent(vibe.category)}`}
                className="group relative aspect-[3/2] overflow-hidden rounded-2xl"
              >
                <Image
                  src={vibe.image}
                  alt={vibe.category}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/25 to-transparent" />
                <div className="absolute inset-x-4 bottom-4 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">
                    {count > 0 ? `${count} event${count === 1 ? "" : "s"}` : "Coming soon"}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="font-display text-[17px] font-semibold leading-tight">
                      {vibe.category}
                    </p>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur transition group-hover:bg-white group-hover:text-ink-950">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-white/60">{vibe.blurb}</p>
                </div>
              </Link>
            );
          })}
        </div>
        {moreCategories.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {moreCategories.map((category) => {
              const Icon = categoryIcons[category] || CalendarDays;
              return (
                <Link
                  key={category}
                  href={`/events?category=${encodeURIComponent(category)}`}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 transition hover:border-brand-200 hover:text-brand-700"
                >
                  <Icon className="h-3.5 w-3.5 text-brand-600" />
                  {category}
                  <span className="text-[10.5px] text-ink-400">
                    {categoryCount.get(category)}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="container-page mt-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Coming up</p>
            <h2 className="mt-2 font-display text-[26px] font-semibold tracking-[-0.035em] text-ink-950 md:text-[32px]">
              Events worth clearing your calendar for
            </h2>
          </div>
          <Link
            href="/events"
            className="hidden items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:text-brand-800 sm:flex"
          >
            Browse all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-6 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
        <div className="mt-8 sm:hidden">
          <Link href="/events" className="btn btn-outline w-full">
            Browse all events <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="container-page mt-20">
        <div className="relative overflow-hidden rounded-[26px] bg-ink-950 px-6 py-10 text-white md:px-11 md:py-12">
          <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-brand-600/40 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-aqua-500/20 blur-3xl" />
          <div className="relative grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-aqua-300">
                For organizers & promoters
              </p>
              <h2 className="mt-3 max-w-lg font-display text-[30px] font-semibold leading-[1.08] tracking-[-0.04em] md:text-[38px]">
                Sell out your next event without losing control of the gate.
              </h2>
              <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-white/55">
                Publish approved events, manage ticket tiers, watch sales in real time and
                give every gate staff member a scanner that cannot admit the same ticket twice.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <Link href="/organizer/apply" className="btn btn-primary">
                  Apply as an organizer <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="btn border border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  Open demo dashboard
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[11.5px] text-white/45">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-white/30" /> Admin-reviewed publishing
                </span>
                <span className="flex items-center gap-1.5">
                  <Ticket className="h-3.5 w-3.5 text-white/30" /> Transparent service fees
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-white/30" /> Zimbabwe-first payouts
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
                    Live gate · Neon Nights
                  </p>
                  <p className="mt-1 font-display text-[22px] font-semibold">1,284 admitted</p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10.5px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-brand-400 to-aqua-400" />
              </div>
              <div className="mt-2 flex justify-between text-[10.5px] text-white/40">
                <span>78% checked in</span>
                <span>1,646 issued</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Accepted", value: "1,284", tone: "text-emerald-300" },
                  { label: "Duplicates", value: "17", tone: "text-amber-300" },
                  { label: "Rejected", value: "6", tone: "text-rose-300" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl bg-black/20 px-2.5 py-2.5">
                    <p className="text-[10px] text-white/40">{stat.label}</p>
                    <p className={`mt-1 font-display text-[16px] font-semibold ${stat.tone}`}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl bg-black/20 p-2.5">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-400/15 text-emerald-300">
                    <ScanLine className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-white/70">VIP · Tino M. · Gate A</span>
                  <span className="ml-auto text-[10px] text-white/30">just now</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page mt-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Find your event",
              text: "Search by artist, venue, city or date. Compare tiers and see live availability before you commit.",
            },
            {
              step: "02",
              title: "Checkout securely",
              text: "Your tickets are reserved while you pay. Paid tickets are issued only after verified payment.",
            },
            {
              step: "03",
              title: "Scan and you're in",
              text: "Show your QR at the gate. Each ticket is valid for one admission — screenshots cannot be reused.",
            },
          ].map((item) => (
            <div key={item.step} className="relative rounded-2xl border border-line bg-white p-6">
              <span className="font-display text-[12px] font-semibold text-brand-600">
                {item.step}
              </span>
              <h3 className="mt-3 font-display text-[17px] font-semibold tracking-[-0.02em]">
                {item.title}
              </h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-400">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
