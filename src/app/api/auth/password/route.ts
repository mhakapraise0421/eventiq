import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { writeAudit } from "@/lib/audit";
import { jsonError, readJson, sameOrigin } from "@/lib/api";

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);

  const body = await readJson<{ currentPassword?: string; newPassword?: string }>(request);
  if (!body) return jsonError("Invalid request body.");

  const currentPassword = (body.currentPassword || "").trim();
  const newPassword = (body.newPassword || "").trim();
  if (!currentPassword || !newPassword) {
    return jsonError("Enter your current and new password.");
  }
  if (newPassword.length < 8) {
    return jsonError("Your new password must be at least 8 characters.");
  }
  if (newPassword === currentPassword) {
    return jsonError("Choose a password different from your current one.");
  }

  const record = get<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = ?",
    user.id,
  );
  if (!record || !verifyPassword(currentPassword, record.password_hash)) {
    return jsonError("Your current password is incorrect.", 401);
  }

  run("UPDATE users SET password_hash = ? WHERE id = ?", hashPassword(newPassword), user.id);
  writeAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "user.password_changed",
    entityType: "user",
    entityId: user.id,
    ip: request.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ ok: true });
}
