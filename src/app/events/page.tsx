import type { Metadata } from "next";
import Link from "next/link";
import { Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { EventCard } from "@/components/event-card";
import { EmptyState } from "@/components/empty-state";
import { listPublicEvents, type EventFilters } from "@/lib/events";
import { CATEGORIES, CITIES } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Discover events",
  description:
    "Browse concerts, festivals, nightlife, weddings, church events and conferences across Zimbabwe.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters: EventFilters = {
    q: valueOf(params, "q"),
    category: valueOf(params, "category"),
    city: valueOf(params, "city"),
    date: valueOf(params, "date"),
    price: valueOf(params, "price"),
    availability: valueOf(params, "availability"),
    sort: valueOf(params, "sort"),
  };
  const events = listPublicEvents(filters);
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div>
      <div className="border-b border-line bg-surface/70">
        <div className="container-page py-9">
          <p className="eyebrow">Discover Zimbabwe</p>
          <h1 className="mt-2 font-display text-[32px] font-semibold tracking-[-0.04em] text-ink-950 md:text-[40px]">
            Events worth showing up for
          </h1>
          <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-ink-500">
            From Harare rooftop sessions to Victoria Falls sundowners — find the room
            you want to be in, then lock in your ticket.
          </p>

          <form action="/events" className="mt-6">
            <div className="card flex flex-col gap-2 p-2 shadow-[0_10px_35px_rgba(8,8,13,0.06)] sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2.5 px-2.5">
                <Search className="h-4 w-4 shrink-0 text-ink-300" />
                <input
                  name="q"
                  defaultValue={filters.q}
                  placeholder="Search events, artists, venues…"
                  aria-label="Search events"
                  className="h-10 w-full border-0 bg-transparent text-[14px] outline-none placeholder:text-ink-300"
                />
              </div>
              <div className="hidden h-7 w-px bg-line sm:block" />
              <select
                name="city"
                defaultValue={filters.city}
                aria-label="City"
                className="h-10 rounded-lg bg-transparent px-2.5 text-[13px] font-medium text-ink-600 outline-none"
              >
                <option value="">All cities</option>
                {CITIES.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </select>
              <select
                name="category"
                defaultValue={filters.category}
                aria-label="Category"
                className="h-10 rounded-lg bg-transparent px-2.5 text-[13px] font-medium text-ink-600 outline-none"
              >
                <option value="">All categories</option>
                {CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
              <button className="btn btn-primary">
                <Search className="h-4 w-4" /> Search
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                <Filter className="h-3.5 w-3.5" /> Refine
              </span>
              {[
                {
                  name: "date",
                  label: "When",
                  options: [
                    ["", "Any date"],
                    ["week", "Next 7 days"],
                    ["month", "Next 30 days"],
                    ["today", "Today"],
                  ],
                },
                {
                  name: "price",
                  label: "Price",
                  options: [
                    ["", "Any price"],
                    ["free", "Free"],
                    ["under25", "Under $25"],
                    ["25to50", "$25 – $50"],
                    ["over50", "Over $50"],
                  ],
                },
                {
                  name: "availability",
                  label: "Availability",
                  options: [
                    ["", "All"],
                    ["available", "Tickets available"],
                  ],
                },
              ].map((filter) => (
                <select
                  key={filter.name}
                  name={filter.name}
                  defaultValue={
                    filter.name === "date"
                      ? filters.date
                      : filter.name === "price"
                        ? filters.price
                        : filters.availability
                  }
                  aria-label={filter.label}
                  className="h-9 rounded-full border border-line bg-white px-3.5 text-[12px] font-medium text-ink-600 outline-none focus:border-brand-400"
                >
                  {filter.options.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              ))}

              <select
                name="sort"
                defaultValue={filters.sort}
                aria-label="Sort events"
                className="h-9 rounded-full border border-line bg-white px-3.5 text-[12px] font-medium text-ink-600 outline-none focus:border-brand-400"
              >
                <option value="">Soonest first</option>
                <option value="price">Lowest price</option>
                <option value="title">A – Z</option>
              </select>

              <button type="submit" className="btn btn-dark btn-sm">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Apply filters
              </button>
              {hasFilters ? (
                <Link
                  href="/events"
                  className="flex items-center gap-1 text-[12px] font-semibold text-ink-400 hover:text-ink-700"
                >
                  <X className="h-3.5 w-3.5" /> Clear
                </Link>
              ) : null}
            </div>
          </form>
        </div>
      </div>

      <div className="container-page mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[13px] text-ink-400">
            <span className="font-semibold text-ink-900">{events.length}</span>{" "}
            event{events.length === 1 ? "" : "s"}
            {hasFilters ? " matching your filters" : " coming up"}
          </p>
          {hasFilters ? (
            <p className="text-[12px] text-ink-400">
              Showing results across all cities and categories
            </p>
          ) : null}
        </div>

        {events.length ? (
          <div className="mt-6 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event, index) => (
              <EventCard key={event.id} event={event} priority={index < 3} />
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              title="No events match those filters"
              description="Try widening the date range, removing the city filter, or searching for a different artist or venue."
              actionHref="/events"
              actionLabel="Clear all filters"
              icon={<Search className="h-5 w-5" />}
            />
          </div>
        )}
      </div>
    </div>
  );
}
