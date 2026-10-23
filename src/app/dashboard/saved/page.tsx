import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Heart } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listFavoriteEventIds, listFavoriteEvents } from "@/lib/attendee";
import { ConsoleHeader } from "@/components/console-header";
import { EventCard } from "@/components/event-card";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Saved events" };

const tabs = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/tickets", label: "My tickets" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/saved", label: "Saved" },
  { href: "/dashboard/parking", label: "Parking" },
  { href: "/dashboard/profile", label: "Profile" },
];

export default async function SavedEventsPage() {
  const user = await requireUser();
  const favoriteIds = listFavoriteEventIds(user.id);
  const favoriteSet = new Set(favoriteIds);
  const events = listFavoriteEvents(user.id, 36);

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Attendee account"
        title="Saved events"
        description="Events you have hearted — keep an eye on them and book before they sell out."
        tabs={tabs}
        actions={
          <Link href="/events" className="btn btn-primary btn-sm">
            Discover more
          </Link>
        }
      />

      <div className="container-page pt-6">
        {events.length ? (
          <>
            <p className="text-[13px] text-ink-400">
              <span className="font-semibold text-ink-900">{events.length}</span> saved
              event{events.length === 1 ? "" : "s"}
            </p>
            <div className="mt-5 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  favorite={{ favorited: favoriteSet.has(event.id), authenticated: true }}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-6">
            <EmptyState
              icon={<Heart className="h-5 w-5" />}
              title="Nothing saved yet"
              description="Tap the heart on any event to keep it here. Saved events also help us suggest events you will like."
              actionHref="/events"
              actionLabel="Browse events"
            />
          </div>
        )}

        <div className="mt-10 flex items-start gap-2 rounded-2xl border border-line bg-white p-4 text-[11.5px] text-ink-500">
          <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
          <p>
            Saving an event does not reserve a ticket. If an event sells out while it is on
            your list, we will let you know on your dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
