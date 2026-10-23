import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { requireRolePage } from "@/lib/auth";
import { getEventById } from "@/lib/events";
import { getGateAssignment, isAssignedToEvent } from "@/lib/gate";
import { formatDate, formatTime } from "@/lib/format";
import { ScannerConsole } from "@/components/scanner-console";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scan tickets" };

export default async function ScanEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireRolePage(["gate", "admin", "ceo"]);
  const { eventId } = await params;
  const event = getEventById(eventId);
  if (!event) notFound();

  const isOversight = user.role === "admin" || user.role === "ceo";
  if (!isOversight && !isAssignedToEvent(user.id, eventId)) {
    redirect("/scan?denied=1");
  }

  const assignment = getGateAssignment(user.id, eventId);

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <div className="border-b border-line bg-surface/70">
        <div className="container-page max-w-3xl pb-4 pt-6">
          <Link
            href="/scan"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All scan events
          </Link>
          <p className="eyebrow mt-3">Gate scanner</p>
          <h1 className="mt-1 font-display text-[24px] font-semibold tracking-[-0.03em] text-ink-950">
            {event.title}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-500">
            <span>
              {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {event.venue}, {event.city}
            </span>
            <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-ink-700 ring-1 ring-line">
              {assignment?.gate_name || "Oversight"}
            </span>
          </p>
        </div>
      </div>

      <div className="container-page max-w-3xl pt-5">
        <ScannerConsole
          eventId={event.id}
          eventTitle={event.title}
          gateName={assignment?.gate_name || "Oversight"}
          canOverride={isOversight}
        />
      </div>
    </div>
  );
}
