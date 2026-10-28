import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarOff, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { requireArtistPage } from "@/lib/guards";
import { listArtistAvailability, listArtistBookings } from "@/lib/bookings";
import {
  WEEKDAY_LABELS,
  itemSpansDay,
  monthFromParam,
  monthMeta,
} from "@/lib/calendar";
import { formatDate, formatTime } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { artistTabs } from "@/components/artist-tabs";
import { AvailabilityManager } from "@/components/availability-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendar" };

interface DayItem {
  type: "accepted" | "requested" | "unavailable";
  label: string;
  time?: string;
}

const CHIP_STYLE: Record<DayItem["type"], string> = {
  accepted: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  requested: "bg-amber-50 text-amber-800 ring-amber-200",
  unavailable: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

const ITEM_DOT: Record<DayItem["type"], string> = {
  accepted: "bg-emerald-500",
  requested: "bg-amber-400",
  unavailable: "bg-zinc-400",
};

const ITEM_WORD: Record<DayItem["type"], string> = {
  accepted: "Confirmed",
  requested: "Awaiting response",
  unavailable: "Unavailable",
};

export default async function ArtistCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { profile } = await requireArtistPage();
  const params = await searchParams;
  const meta = monthMeta(monthFromParam(params.month));

  const bookings = listArtistBookings(profile.user_id);
  const activeBookings = bookings.filter(
    (booking) => booking.status === "accepted" || booking.status === "requested",
  );
  const blocks = listArtistAvailability(profile.user_id, meta.startISO, meta.endISO);
  const upcomingBlocks = listArtistAvailability(profile.user_id).filter(
    (block) => new Date(block.ends_at).getTime() > Date.now(),
  );

  const itemsByDay = new Map<string, DayItem[]>();
  const addItem = (dayKey: string, item: DayItem) => {
    const list = itemsByDay.get(dayKey) || [];
    list.push(item);
    itemsByDay.set(dayKey, list);
  };

  for (const booking of activeBookings) {
    for (const day of meta.days) {
      if (itemSpansDay(booking.event_starts_at, booking.event_ends_at, day.key)) {
        addItem(day.key, {
          type: booking.status === "accepted" ? "accepted" : "requested",
          label: booking.event_title,
          time: formatTime(booking.event_starts_at),
        });
      }
    }
  }
  for (const block of blocks) {
    for (const day of meta.days) {
      if (itemSpansDay(block.starts_at, block.ends_at, day.key)) {
        addItem(day.key, {
          type: "unavailable",
          label: block.note || "Unavailable",
        });
      }
    }
  }

  const monthBookings = activeBookings
    .filter((booking) =>
      meta.days.some(
        (day) =>
          day.inMonth &&
          itemSpansDay(booking.event_starts_at, booking.event_ends_at, day.key),
      ),
    )
    .sort(
      (a, b) =>
        new Date(a.event_starts_at).getTime() - new Date(b.event_starts_at).getTime(),
    );

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Artist console"
        title="Performance calendar"
        description="Confirmed bookings, pending requests and the dates you have blocked out."
        tabs={artistTabs}
      />

      <div className="container-page max-w-5xl space-y-5 pt-6">
        <section className="rounded-2xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-[-0.02em]">
              <CalendarDays className="h-4 w-4 text-brand-600" /> {meta.label}
            </h2>
            <div className="flex items-center gap-1.5">
              <Link
                href={`/artist/calendar?month=${meta.prevKey}`}
                className="btn btn-outline btn-sm h-8 w-8 px-0"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link href="/artist/calendar" className="btn btn-ghost btn-sm h-8">
                Today
              </Link>
              <Link
                href={`/artist/calendar?month=${meta.nextKey}`}
                className="btn btn-outline btn-sm h-8 w-8 px-0"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[10.5px] text-ink-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Confirmed booking
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Awaiting response
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-zinc-400" /> Unavailable
            </span>
            <span className="text-ink-400">Times shown in Africa/Harare (CAT)</span>
          </div>

          <div className="hide-scrollbar mt-3 overflow-x-auto lg:overflow-visible">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="px-1 pb-1 text-center text-[10px] font-bold uppercase tracking-[0.06em] text-ink-400"
                  >
                    {label}
                  </div>
                ))}
                {meta.days.map((day, dayIndex) => {
                  const items = itemsByDay.get(day.key) || [];
                  return (
                    <div
                      key={day.key}
                      className={`group relative min-h-[82px] rounded-lg border p-1.5 ${
                        day.isToday
                          ? "border-brand-300 bg-brand-50/40"
                          : day.inMonth
                            ? "border-line bg-white"
                            : "border-transparent bg-surface/40"
                      }`}
                    >
                      <p
                        className={`text-[10.5px] font-semibold ${
                          day.isToday
                            ? "text-brand-700"
                            : day.inMonth
                              ? "text-ink-700"
                              : "text-ink-300"
                        }`}
                      >
                        {day.day}
                      </p>
                      <div className="mt-1 space-y-1">
                        {items.slice(0, 2).map((item, index) => (
                          <p
                            key={`${item.label}-${index}`}
                            className={`truncate rounded px-1 py-0.5 text-[9.5px] font-semibold ring-1 ${CHIP_STYLE[item.type]}`}
                            title={`${item.label}${item.time ? ` · ${item.time}` : ""}`}
                          >
                            {item.label}
                          </p>
                        ))}
                        {items.length > 2 ? (
                          <p className="px-1 text-[9px] text-ink-400">+{items.length - 2} more</p>
                        ) : null}
                      </div>

                      {items.length ? (
                        <div
                          className={`pointer-events-none absolute top-full z-30 mt-1 hidden w-60 rounded-xl border border-line bg-white p-3 text-left opacity-0 shadow-xl ring-1 ring-black/5 transition duration-150 group-hover:opacity-100 lg:block ${
                            dayIndex % 7 >= 5 ? "right-0" : "left-0"
                          }`}
                        >
                          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-400">
                            {formatDate(day.key)}
                          </p>
                          <ul className="mt-1.5 space-y-1.5">
                            {items.map((item, index) => (
                              <li key={`${item.label}-${index}`} className="flex items-start gap-2">
                                <span
                                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${ITEM_DOT[item.type]}`}
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-[11.5px] font-semibold text-ink-900">
                                    {item.label}
                                  </p>
                                  <p className="text-[10px] text-ink-400">
                                    {item.time ? `${item.time} · ` : ""}
                                    {ITEM_WORD[item.type]}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
              <Clock className="h-4 w-4 text-brand-600" /> {meta.label} at a glance
            </h2>
            {monthBookings.length ? (
              <ul className="mt-3 space-y-2">
                {monthBookings.map((booking) => (
                  <li
                    key={booking.id}
                    className="rounded-xl border border-line px-3.5 py-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[12px] font-semibold text-ink-950">
                        {booking.event_title}
                      </p>
                      <span className={`badge ${CHIP_STYLE[booking.status === "accepted" ? "accepted" : "requested"]}`}>
                        {booking.status === "accepted" ? "Confirmed" : "Awaiting response"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-ink-500">
                      {formatDate(booking.event_starts_at)} ·{" "}
                      {formatTime(booking.event_starts_at)} · {booking.event_venue}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-line px-3.5 py-5 text-[11.5px] text-ink-400">
                No bookings in {meta.label}. Accepted gigs and pending requests will show here.
              </p>
            )}
            <Link
              href="/artist/bookings"
              className="mt-3 inline-block text-[11px] font-semibold text-brand-700 hover:underline"
            >
              Manage booking requests
            </Link>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
              <CalendarOff className="h-4 w-4 text-ink-500" /> Unavailable dates
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
              Organizers cannot book you for a time that overlaps a block. Notes stay private.
            </p>
            <div className="mt-4">
              <AvailabilityManager blocks={upcomingBlocks} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
