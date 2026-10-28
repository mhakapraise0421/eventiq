import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Download,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Mic,
  Phone,
  UserRound,
} from "lucide-react";
import { requireRolePage } from "@/lib/auth";
import {
  countPendingArtistVerifications,
  listArtistVerificationQueue,
  listDocumentsForVerification,
} from "@/lib/artists";
import { formatDate, formatDateTime } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { adminTabs } from "@/components/admin-tabs";
import { StatusBadge } from "@/components/status-badge";
import { ArtistVerificationDecision } from "@/components/artist-controls";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artist verification" };

const filters = [
  { key: "pending", label: "Pending" },
  { key: "requires_info", label: "More info needed" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AdminArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRolePage(["admin", "ceo"]);
  const { status = "pending" } = await searchParams;

  const all = listArtistVerificationQueue("all");
  const requests = listArtistVerificationQueue(status);
  const counts = {
    pending: all.filter((item) => item.status === "pending").length,
    requires_info: all.filter((item) => item.status === "requires_info").length,
    verified: all.filter((item) => item.status === "verified").length,
    rejected: all.filter((item) => item.status === "rejected").length,
    all: all.length,
  };

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Governance console"
        title="Artist verification"
        description="Review artist identity submissions. Documents are private and only open through this authenticated console."
        tabs={adminTabs({ artists: countPendingArtistVerifications() })}
      />

      <div className="container-page max-w-5xl pt-6">
        <div className="hide-scrollbar flex items-center gap-1 overflow-x-auto">
          {filters.map((item) => (
            <Link
              key={item.key}
              href={`/admin/artists?status=${item.key}`}
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

        {requests.length ? (
          <div className="mt-5 space-y-4">
            {requests.map((request) => {
              const documents = listDocumentsForVerification(request.id);
              return (
                <article key={request.id} className="rounded-2xl border border-line bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                        <Mic className="h-5 w-5" />
                      </span>
                      <div>
                        <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
                          {request.stage_name}
                        </h2>
                        <p className="mt-0.5 text-[11px] text-ink-400">
                          {request.category}
                          {request.city ? ` · ${request.city}` : ""} · Submitted{" "}
                          {formatDateTime(request.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <StatusBadge status={request.status} kind="verification" />
                      <span className="text-[10px] text-ink-400">
                        {request.visibility === "published"
                          ? "Public directory profile"
                          : "Draft profile"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-[11.5px] sm:grid-cols-2">
                    <p className="flex items-center gap-1.5 text-ink-600">
                      <UserRound className="h-3.5 w-3.5 text-ink-400" /> {request.user_name}
                    </p>
                    <p className="flex items-center gap-1.5 text-ink-600">
                      <Mail className="h-3.5 w-3.5 text-ink-400" /> {request.user_email}
                    </p>
                    <p className="flex items-center gap-1.5 text-ink-600">
                      <Phone className="h-3.5 w-3.5 text-ink-400" /> {request.user_phone || "—"}
                    </p>
                    <p className="flex items-center gap-1.5 text-ink-600">
                      <MapPin className="h-3.5 w-3.5 text-ink-400" /> {request.city || "—"}
                    </p>
                  </div>

                  <p className="mt-3 rounded-xl bg-surface/60 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-ink-500">
                    {request.bio}
                  </p>

                  {request.note ? (
                    <p className="mt-2 text-[11px] text-ink-500">
                      <strong>Artist note:</strong> {request.note}
                    </p>
                  ) : null}

                  <div className="mt-3 border-t border-line pt-3">
                    <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-400">
                      <FileText className="h-3 w-3" /> Documents ({documents.length})
                    </p>
                    {documents.length ? (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {documents.map((doc) => (
                          <li key={doc.id}>
                            <a
                              href={`/api/artist/documents/${doc.id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-ink-700 hover:border-ink-300"
                            >
                              <Download className="h-3 w-3 text-ink-400" />
                              {doc.label}
                              <span className="text-[10px] font-normal text-ink-400">
                                {formatSize(doc.size)}
                              </span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1.5 text-[11px] text-ink-400">
                        No documents attached. Verification cannot be granted without one.
                      </p>
                    )}
                  </div>

                  {request.reviewed_at ? (
                    <p className="mt-2 text-[10.5px] text-ink-400">
                      Last review {formatDate(request.reviewed_at)}
                      {request.decision_note ? ` · ${request.decision_note}` : ""}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {request.visibility === "published" ? (
                      <Link
                        href={`/artists/${request.slug}`}
                        className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-brand-700"
                      >
                        <ExternalLink className="h-3 w-3" /> Public profile
                      </Link>
                    ) : null}
                    {request.status === "pending" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-ink-400">
                        <BadgeCheck className="h-3 w-3" /> Verified badge is only granted after
                        document review
                      </span>
                    ) : null}
                  </div>

                  {request.status === "pending" ? (
                    <div className="mt-3 border-t border-line pt-3">
                      <ArtistVerificationDecision
                        requestId={request.id}
                        canVerify={documents.length > 0}
                      />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              icon={<Mic className="h-5 w-5" />}
              title="Nothing in this queue"
              description="Artist verification requests matching this filter will appear here."
            />
          </div>
        )}
      </div>
    </div>
  );
}
