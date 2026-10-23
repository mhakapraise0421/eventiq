import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { run } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { jsonError, readJson, sameOrigin } from "@/lib/api";

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);

  const body = await readJson<{
    name?: string;
    phone?: string;
    city?: string;
    notifyEmail?: boolean;
    notifySms?: boolean;
    notifyWhatsapp?: boolean;
  }>(request);
  if (!body) return jsonError("Invalid request body.");

  const name = (body.name || user.name).trim();
  if (name.length < 2) return jsonError("Please enter your full name.");
  const phone = (body.phone ?? user.phone ?? "").toString().trim() || null;
  const city = (body.city ?? user.city ?? "").toString().trim() || null;
  const flag = (value: boolean | undefined, current: number | undefined) =>
    value === undefined ? Number(current ?? 1) : value ? 1 : 0;

  run(
    `UPDATE users SET name = ?, phone = ?, city = ?, notify_email = ?, notify_sms = ?, notify_whatsapp = ?
     WHERE id = ?`,
    name,
    phone,
    city,
    flag(body.notifyEmail, user.notify_email),
    flag(body.notifySms, user.notify_sms),
    flag(body.notifyWhatsapp, user.notify_whatsapp),
    user.id,
  );

  writeAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "profile.updated",
    entityType: "user",
    entityId: user.id,
    before: { name: user.name, phone: user.phone, city: user.city },
    after: { name, phone, city },
    ip: request.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ ok: true });
}
