import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText, History, ShieldCheck } from "lucide-react";
import { requireArtistPage } from "@/lib/guards";
import { listArtistReports } from "@/lib/artist-reports";
import {
  ARTIST_REPORT_TYPE_LABEL,
  BOOKING_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  formatCivilDate,
  formatDateTime,
} from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { artistTabs } from "@/components/artist-tabs";
import { EmptyState } from "@/components/empty-state";
import { ReportGenerator } from "@/components/report-generator";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reports" };

function shortId(id: string) {
  return `${id.slice(0, 10)}…`;
}

function filterLabel(value: string | null, kind: "payment" | "booking") {
  if (!value) return kind === "payment" ? "All payments" : "All bookings";
  const labels = kind === "payment" ? PAYMENT_STATUS_LABEL : BOOKING_STATUS_LABEL;
  return labels[value] || value;
}

export default async function ArtistReportsPage() {
  const { profile } = await requireArtistPage();
  const reports = listArtistReports(profile.user_id);
  const current = reports.filter((report) => !report.superseded_by_id);
  const superseded = reports.filter((report) => report.superseded_by_id);

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Artist console"
        title="Reports"
        description="Server-generated PDF reports with a unique ID, a stored SHA-256 hash and an immutable history."
        tabs={artistTabs}
        actions={
          <Link href="/artist/analytics" className="btn btn-outline btn-sm">
            Analytics
          </Link>
        }
      />

      <div className="container-page max-w-5xl space-y-4 pt-6">
        <section className="rounded-2xl border border-line bg-white px-4 py-3 text-[11px] leading-relaxed text-ink-500">
          Every report is calculated on the server and saved to private storage. A SHA-256 hash of
          the final PDF is recorded at generation time, and each download is checked against that
          hash before it is served. Reports are never overwritten: generating the same report again
          creates a new version and marks the earlier one as superseded.
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              <FileText className="h-3.5 w-3.5" /> Reports generated
            </p>
            <p className="mt-1.5 font-display text-[22px] font-semibold text-ink-950">
              {reports.length}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              <ShieldCheck className="h-3.5 w-3.5" /> Current versions
            </p>
            <p className="mt-1.5 font-display text-[22px] font-semibold text-ink-950">
              {current.length}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
              <History className="h-3.5 w-3.5" /> Superseded
            </p>
            <p className="mt-1.5 font-display text-[22px] font-semibold text-ink-950">
              {superseded.length}
            </p>
          </div>
        </div>

        <ReportGenerator />

        <section className="rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[15px] font-semibold text-ink-950">
                Report library
              </h2>
              <p className="mt-1 text-[11px] text-ink-400">
                Newest first. Superseded reports stay downloadable so earlier versions are never
                lost.
              </p>
            </div>
            <span className="badge bg-surface text-ink-500">{reports.length} total</span>
          </div>

          {reports.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Period</th>
                    <th>Filters</th>
                    <th>Generated</th>
                    <th className="text-right">Size</th>
                    <th>Status</th>
                    <th className="text-right">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id}>
                      <td>
                        <p className="font-semibold text-ink-950">
                          {ARTIST_REPORT_TYPE_LABEL[report.report_type] || report.report_type}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-ink-400" title={report.id}>
                          {report.id}
                        </p>
                        <p
                          className="mt-0.5 font-mono text-[9.5px] text-ink-400"
                          title={report.pdf_sha256}
                        >
                          SHA-256 {report.pdf_sha256.slice(0, 16)}…
                        </p>
                      </td>
                      <td className="whitespace-nowrap text-[11px] text-ink-600">
                        {formatCivilDate(report.period_start)}
                        <span className="text-ink-300"> – </span>
                        {formatCivilDate(report.period_end)}
                      </td>
                      <td className="text-[10.5px] leading-relaxed text-ink-500">
                        <p>{filterLabel(report.payment_status, "payment")}</p>
                        <p>{filterLabel(report.booking_status, "booking")}</p>
                      </td>
                      <td className="whitespace-nowrap text-[11px] text-ink-500">
                        {formatDateTime(report.created_at)}
                      </td>
                      <td className="whitespace-nowrap text-right text-[11px] text-ink-500">
                        {Math.max(1, Math.round(report.bytes / 1024))} kB
                      </td>
                      <td>
                        {report.superseded_by_id ? (
                          <div>
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                              Superseded
                            </span>
                            <p className="mt-1 font-mono text-[9.5px] text-ink-400">
                              by {shortId(report.superseded_by_id)}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                              Current
                            </span>
                            {report.supersedes_id ? (
                              <p className="mt-1 font-mono text-[9.5px] text-ink-400">
                                replaces {shortId(report.supersedes_id)}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <a
                          href={`/api/artist/reports/${report.id}/download`}
                          className="btn btn-outline btn-sm"
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No reports yet"
                description="Choose a report type and period above to generate your first PDF. It will appear here with its own ID and hash."
                icon={<FileText className="h-5 w-5" />}
              />
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-surface/60 p-4 text-[10.5px] leading-relaxed text-ink-400">
          <p>
            Reports are private to your artist account and are not ranked, published or shared with
            organizers. They are generated from accepted agreements, confirmed payment records and
            issued invoices, and they are not audited financial statements. EventIQ does not process
            payments or hold funds, and does not yet track expenses, so no figure in a report is
            profit.
          </p>
          <p className="mt-1.5">
            If the underlying records change, generate a new report. The earlier version keeps its
            ID, hash and stored file, and the new version records which report it supersedes.
          </p>
        </section>
      </div>
    </div>
  );
}
