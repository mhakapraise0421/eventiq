import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireApprovedOrganizer } from "@/lib/guards";
import { getEventById, getTicketTypes } from "@/lib/events";
import { ConsoleHeader } from "@/components/console-header";
import { OrganizerEventForm } from "@/components/organizer-event-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit event" };

const tabs = [
  { href: "/organizer", label: "Overview" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/artists", label: "Artists" },
  { href: "/organizer/reports", label: "Reports" },
  { href: "/organizer/apply", label: "Application" },
];

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireApprovedOrganizer();
  const { id } = await params;
  const event = getEventById(id);
  if (!event || event.organizer_id !== user.id) notFound();
  if (!["draft", "rejected"].includes(event.status)) {
    redirect(`/organizer/events/${event.id}`);
  }

  const tiers = getTicketTypes(event.id);

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Organizer console"
        title="Edit event"
        description="Update the details of this draft. Ticket types can be changed until the event is submitted."
        tabs={tabs}
        actions={
          <Link href={`/organizer/events/${event.id}`} className="btn btn-outline btn-sm">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to event
          </Link>
        }
      />
      <div className="container-page max-w-4xl pt-6">
        <OrganizerEventForm
          mode="edit"
          event={{
            id: event.id,
            title: event.title,
            tagline: event.tagline,
            description: event.description,
            category: event.category,
            city: event.city,
            venue: event.venue,
            address: event.address,
            starts_at: event.starts_at,
            ends_at: event.ends_at,
            cover_image: event.cover_image,
            age_limit: event.age_limit,
            terms: event.terms,
          }}
          tiers={tiers.map((tier) => ({
            name: tier.name,
            description: tier.description,
            price_cents: tier.price_cents,
            capacity: tier.capacity,
            max_per_order: tier.max_per_order,
            perks: tier.perks,
          }))}
        />
      </div>
    </div>
  );
}
