import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import type { EventRecord } from "@/lib/types";
import { formatDayParts, formatMoney, formatTime } from "@/lib/format";

export function EventCard({ event, priority = false }: { event: EventRecord; priority?: boolean }) {
  const date = formatDayParts(event.starts_at);
  const remaining = Math.max(0, (event.total_capacity || 0) - (event.tickets_sold || 0));
  const soldOut = remaining === 0;
  const sellingFast =
    !soldOut && (event.total_capacity || 0) > 0 && remaining / (event.total_capacity || 1) < 0.2;
  const minPrice = event.min_price_cents ?? 0;

  return (
    <Link href={`/events/${event.slug}`} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-brand-100 via-surface to-aqua-300/30">
        {event.cover_image ? (
          <Image
            src={event.cover_image}
            alt={event.title}
            fill
            unoptimized
            priority={priority}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-black/5" />
        <div className="absolute left-3 top-3 flex flex-col items-center rounded-xl bg-white/95 px-2.5 py-2 text-center shadow-sm backdrop-blur">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
            {date.month}
          </span>
          <span className="font-display text-[19px] font-semibold leading-none text-ink-950">
            {date.day}
          </span>
        </div>
        <div className="absolute right-3 top-3 rounded-full bg-ink-950/75 px-2.5 py-1 text-[10.5px] font-semibold text-white backdrop-blur">
          {event.category}
        </div>
        {soldOut ? (
          <div className="absolute inset-x-3 bottom-3 rounded-lg bg-ink-950/80 px-3 py-2 text-center text-[11px] font-semibold text-white backdrop-blur">
            Sold out
          </div>
        ) : sellingFast ? (
          <div className="absolute inset-x-3 bottom-3 rounded-lg bg-white/90 px-3 py-2 text-center text-[11px] font-semibold text-brand-700 backdrop-blur">
            Selling fast · {remaining} left
          </div>
        ) : null}
      </div>

      <div className="pt-3.5">
        <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-400">
          <CalendarDays className="h-3.5 w-3.5" />
          {date.weekday} · {formatTime(event.starts_at)}
          <span className="text-ink-300">·</span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {event.city}
          </span>
        </div>
        <h3 className="mt-1.5 line-clamp-2 font-display text-[16.5px] font-semibold leading-snug tracking-[-0.02em] text-ink-950 group-hover:text-brand-700">
          {event.title}
        </h3>
        <p className="mt-1 truncate text-[12.5px] text-ink-400">{event.venue}</p>
        <div className="mt-2.5 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink-900">
            {minPrice === 0 ? "Free entry" : `From ${formatMoney(minPrice)}`}
          </p>
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100">
            View event <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
