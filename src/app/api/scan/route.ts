import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { getGateAssignment, validateScan } from "@/lib/gate";
import { parseScannedPayload } from "@/lib/ticket-code";
import { writeAudit } from "@/lib/audit";
import { mfaSatisfied } from "@/lib/mfa";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user || !["gate", "admin", "ceo"].includes(user.role)) {
    return jsonError("Not authorised to scan tickets.", 403);
  }
  if (!mfaSatisfied(user)) {
    return jsonError("Two-factor authentication is required for scanning.", 403);
  }

  const limited = rateLimit(`scan:${user.id}`, 90, 60_000);
  if (!limited.ok) {
    return jsonError("Too many scans. Slow down and try again shortly.", 429);
  }

  const body = await readJson<{ eventId?: string; raw?: string; deviceId?: string | null }>(
    request,
  );
  if (!body?.eventId) return jsonError("Select an event before scanning.");
  if (!body.raw || !body.raw.trim()) return jsonError("No ticket code received.");

  const code = parseScannedPayload(body.raw);
  if (!code) {
    return NextResponse.json({
      result: "invalid",
      message: "Unrecognised ticket format. Do not admit.",
      scannedAt: new Date().toISOString(),
    });
  }

  const bypass = user.role === "admin" || user.role === "ceo";
  const assignment = getGateAssignment(user.id, body.eventId);

  const outcome = validateScan({
    code,
    eventId: body.eventId,
    bypassAssignment: bypass,
    actor: {
      id: user.id,
      name: user.name,
      role: user.role,
      gate: assignment?.gate_name || (bypass ? "Oversight" : "Unassigned"),
      deviceId: body.deviceId || null,
    },
  });

  if (outcome.result === "unauthorised") {
    writeAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "scan.unauthorised",
      entityType: "event",
      entityId: body.eventId,
      outcome: "failure",
      after: { code, message: outcome.message },
      ip: clientIp(request),
    });
  }

  return NextResponse.json(outcome, { headers: { "Cache-Control": "no-store" } });
}
