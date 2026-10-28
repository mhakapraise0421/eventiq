import type { Metadata } from "next";
import { FileCheck2, ShieldCheck } from "lucide-react";
import { requireArtistPage } from "@/lib/guards";
import { listArtistDocuments, listArtistVerificationHistory } from "@/lib/artists";
import { formatDate, formatDateTime } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { artistTabs } from "@/components/artist-tabs";
import { StatusBadge } from "@/components/status-badge";
import { ArtistVerificationForm } from "@/components/artist-verification-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artist verification" };

export default async function ArtistVerificationPage() {
  const { profile } = await requireArtistPage();
  const documents = listArtistDocuments(profile.user_id);
  const history = listArtistVerificationHistory(profile.user_id);
  const canSubmit =
    profile.verification_status !== "pending" && profile.verification_status !== "verified";

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Artist console"
        title="Identity verification"
        description="Verification proves that you are the artist behind this profile. Documents stay private; only you and EventIQ reviewers can open them."
        tabs={artistTabs}
      />

      <div className="container-page max-w-4xl space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400">
              Current status
            </p>
            <p className="mt-1 text-[13px] font-semibold text-ink-950">{profile.stage_name}</p>
          </div>
          <StatusBadge status={profile.verification_status} kind="verification" />
        </div>

        {profile.verification_status === "pending" ? (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p className="text-[11.5px] leading-relaxed text-amber-800">
              Your request is under review. You can still upload documents, but a new request
              cannot be submitted until this one is decided.
            </p>
          </div>
        ) : null}

        {profile.verification_status === "verified" ? (
          <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <p className="text-[11.5px] leading-relaxed text-emerald-800">
              Your artist identity is verified. This badge stays tied to your profile and is shown
              in the artist directory.
            </p>
          </div>
        ) : null}

        {history.length ? (
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-display text-[15px] font-semibold tracking-[-0.02em]">
              Request history
            </h2>
            <ul className="mt-3 space-y-3">
              {history.map((request) => (
                <li key={request.id} className="rounded-xl border border-line px-3.5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={request.status} kind="verification" />
                    <span className="text-[10.5px] text-ink-400">
                      Submitted {formatDateTime(request.created_at)}
                    </span>
                    {request.reviewed_at ? (
                      <span className="text-[10.5px] text-ink-400">
                        · Reviewed {formatDate(request.reviewed_at)}
                      </span>
                    ) : null}
                  </div>
                  {request.note ? (
                    <p className="mt-1.5 text-[11px] text-ink-500">“{request.note}”</p>
                  ) : null}
                  {request.decision_note ? (
                    <p className="mt-1.5 rounded-lg bg-surface/70 px-3 py-2 text-[11px] text-ink-600">
                      <strong>Reviewer:</strong> {request.decision_note}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ArtistVerificationForm
          status={profile.verification_status}
          canSubmit={canSubmit}
          documents={documents.map((doc) => ({
            id: doc.id,
            label: doc.label,
            fileName: doc.file_name,
            size: doc.size,
            uploadedAt: doc.uploaded_at,
            submitted: !!doc.verification_id,
          }))}
        />
      </div>
    </div>
  );
}
