import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireApprovedOrganizer } from "@/lib/guards";
import { ConsoleHeader } from "@/components/console-header";
import { OrganizerEventForm } from "@/components/organizer-event-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create event" };

const tabs = [
  { href: "/organizer", label: "Overview" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/artists", label: "Artists" },
  { href: "/organizer/reports", label: "Reports" },
  { href: "/organizer/apply", label: "Application" },
];

export default async function NewEventPage() {
  await requireApprovedOrganizer();

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Organizer console"
        title="Create an event"
        description="Set up the event, configure ticket types and save it as a draft. You can submit it for approval when it is ready."
        tabs={tabs}
        actions={
          <Link href="/organizer/events" className="btn btn-outline btn-sm">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to events
          </Link>
        }
      />
      <div className="container-page max-w-4xl pt-6">
        <OrganizerEventForm mode="create" />
      </div>
    </div>
  );
}
