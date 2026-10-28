import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ClipboardCheck } from "lucide-react";
import { requireRolePage } from "@/lib/auth";
import { getOrganizerProfile } from "@/lib/admin";
import { ConsoleHeader } from "@/components/console-header";
import { OrganizerApplyForm } from "@/components/organizer-apply-form";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Organizer application" };

const tabs = [
  { href: "/organizer", label: "Overview" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/artists", label: "Artists" },
  { href: "/organizer/reports", label: "Reports" },
  { href: "/organizer/apply", label: "Application" },
];

export default async function OrganizerApplyPage() {
  const user = await requireRolePage(["organizer", "admin", "ceo"]);
  const profile = getOrganizerProfile(user.id);

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Organizer onboarding"
        title={profile ? "Organizer application" : "Become an EventIQ organizer"}
        description="Submit your business details for verification. Approved organizers can publish events and sell tickets."
        tabs={tabs}
      />

      <div className="container-page max-w-4xl pt-6">
        {profile ? (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400">
                Current status
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-ink-950">
                <BadgeCheck className="h-4 w-4 text-brand-600" /> {profile.business_name}
              </p>
            </div>
            <StatusBadge status={profile.status} kind="organizer" />
          </div>
        ) : (
          <div className="mb-5 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-900">
              <ClipboardCheck className="h-4 w-4" /> Before you start
            </p>
            <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-brand-900/70">
              <li>Have your business or promoter name and registration number ready.</li>
              <li>Provide a working phone number and a link to your social or website.</li>
              <li>Upload or reference a certificate of incorporation for KYC checks.</li>
            </ul>
          </div>
        )}

        {profile?.decision_note ? (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11.5px] leading-relaxed text-amber-800">
            <strong>Reviewer note:</strong> {profile.decision_note}
          </div>
        ) : null}

        {profile?.status === "approved" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-[13px] font-semibold text-emerald-800">
              Your organizer account is approved.
            </p>
            <p className="mt-1 text-[11.5px] text-emerald-700/80">
              You can create events, configure ticket types and submit them for publishing.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/organizer/events/new" className="btn btn-primary btn-sm">
                Create an event
              </Link>
              <Link href="/organizer/events" className="btn btn-outline btn-sm">
                Manage events
              </Link>
            </div>
          </div>
        ) : (
          <OrganizerApplyForm
            initial={
              profile
                ? {
                    business_name: profile.business_name,
                    business_type: profile.business_type,
                    registration_no: profile.registration_no,
                    city: profile.city,
                    website: profile.website,
                    description: profile.description,
                    kyc_document: profile.kyc_document,
                  }
                : undefined
            }
            resubmitting={!!profile}
          />
        )}
      </div>
    </div>
  );
}
