import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Building2, FileText, Mail, MapPin, Phone, Users } from "lucide-react";
import { requireRolePage } from "@/lib/auth";
import { listOrganizerApplications } from "@/lib/admin";
import { formatDate } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { adminTabs } from "@/components/admin-tabs";
import { StatusBadge } from "@/components/status-badge";
import { OrganizerDecision } from "@/components/admin-controls";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Organizer applications" };

const filters = [
  { key: "pending", label: "Pending" },
  { key: "requires_modification", label: "Changes required" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default async function AdminOrganizersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRolePage(["admin", "ceo"]);
  const { status = "pending" } = await searchParams;

  const all = listOrganizerApplications("all");
  const applications = listOrganizerApplications(status);
  const counts = {
    pending: all.filter((item) => item.status === "pending").length,
    requires_modification: all.filter((item) => item.status === "requires_modification").length,
    approved: all.filter((item) => item.status === "approved").length,
    rejected: all.filter((item) => item.status === "rejected").length,
    all: all.length,
  };

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Governance console"
        title="Organizer applications"
        description="Verify business details and KYC documents before granting publishing access."
        tabs={adminTabs({
          organizers: counts.pending + counts.requires_modification,
          events: 0,
          prices: 0,
        })}
      />

      <div className="container-page max-w-5xl pt-6">
        <div className="hide-scrollbar flex items-center gap-1 overflow-x-auto">
          {filters.map((item) => (
            <Link
              key={item.key}
              href={`/admin/organizers?status=${item.key}`}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                status === item.key
                  ? "bg-ink-950 text-white"
                  : "border border-line bg-white text-ink-500 hover:text-ink-900"
              }`}
            >
              {item.label}
              <span className="ml-1.5 opacity-60">
                {counts[item.key as keyof typeof counts]}
              </span>
            </Link>
          ))}
        </div>

        {applications.length ? (
          <div className="mt-5 space-y-4">
            {applications.map((application) => (
              <article
                key={application.user_id}
                className="rounded-2xl border border-line bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <Building2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
                        {application.business_name}
                      </h2>
                      <p className="mt-0.5 text-[11px] text-ink-400">
                        {application.business_type} · Applied {formatDate(application.created_at)}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={application.status} kind="organizer" />
                </div>

                <div className="mt-4 grid gap-3 text-[11.5px] sm:grid-cols-2">
                  <p className="flex items-center gap-1.5 text-ink-600">
                    <Users className="h-3.5 w-3.5 text-ink-400" /> {application.user_name}
                  </p>
                  <p className="flex items-center gap-1.5 text-ink-600">
                    <Mail className="h-3.5 w-3.5 text-ink-400" /> {application.user_email}
                  </p>
                  <p className="flex items-center gap-1.5 text-ink-600">
                    <Phone className="h-3.5 w-3.5 text-ink-400" /> {application.user_phone || "—"}
                  </p>
                  <p className="flex items-center gap-1.5 text-ink-600">
                    <MapPin className="h-3.5 w-3.5 text-ink-400" /> {application.city || "—"}
                  </p>
                  <p className="flex items-center gap-1.5 text-ink-600">
                    <BadgeCheck className="h-3.5 w-3.5 text-ink-400" /> Reg.{" "}
                    {application.registration_no || "Not provided"}
                  </p>
                  <p className="flex items-center gap-1.5 text-ink-600">
                    <FileText className="h-3.5 w-3.5 text-ink-400" />{" "}
                    {application.kyc_document || "No document reference"}
                  </p>
                </div>

                <p className="mt-3 rounded-xl bg-surface/60 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-ink-500">
                  {application.description}
                </p>

                {application.website ? (
                  <a
                    href={application.website}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-[10.5px] font-semibold text-brand-700"
                  >
                    {application.website}
                  </a>
                ) : null}

                {application.decision_note ? (
                  <p className="mt-2 text-[10.5px] text-ink-400">
                    Last decision: {application.decision_note}
                    {application.reviewed_at ? ` · ${formatDate(application.reviewed_at)}` : ""}
                  </p>
                ) : null}

                {["pending", "requires_modification"].includes(application.status) ? (
                  <div className="mt-4 border-t border-line pt-3">
                    <OrganizerDecision userId={application.user_id} />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="Nothing in this queue"
              description="Organizer applications matching this filter will appear here."
            />
          </div>
        )}
      </div>
    </div>
  );
}
