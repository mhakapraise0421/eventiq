import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, jsonError } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
import {
  getArtistReport,
  readArtistReportPdf,
  reportDownloadName,
} from "@/lib/artist-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in to download this report.", 401);
  if (user.role !== "artist") return jsonError("Not authorised.", 403);

  const limited = rateLimit(`artist-report-download:${user.id}`, 30, 60 * 60_000);
  if (!limited.ok) {
    return jsonError("Too many report downloads. Please try again later.", 429);
  }

  const { id } = await params;
  const report = getArtistReport(id, user.id);
  if (!report) return jsonError("Report not found.", 404);

  let result: Awaited<ReturnType<typeof readArtistReportPdf>>;
  try {
    result = await readArtistReportPdf(report);
  } catch (error) {
    console.error("Report PDF read failed", error);
    return jsonError("Could not read the stored report. Try again.", 500);
  }
  if (!result.ok) {
    return jsonError(result.error, result.error.includes("hash") ? 409 : 404);
  }

  writeAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "report.downloaded",
    entityType: "artist_report",
    entityId: report.id,
    after: { reportType: report.report_type, pdfSha256: report.pdf_sha256 },
    ip: clientIp(request),
  });

  return new NextResponse(result.bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${reportDownloadName(report)}"`,
      "Content-Length": String(result.bytes.byteLength),
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
