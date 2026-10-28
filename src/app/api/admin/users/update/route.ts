import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, readJson, sameOrigin } from "@/lib/api";
import { setUserStatus, updateUserRole } from "@/lib/admin";
import { mfaSatisfied } from "@/lib/mfa";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["attendee", "organizer", "artist", "gate", "admin", "ceo"];

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "ceo")) {
    return jsonError("Not authorised.", 403);
  }
  if (!mfaSatisfied(user)) {
    return jsonError("Two-factor authentication is required for this action.", 403);
  }

  const body = await readJson<{
    userId?: string;
    role?: Role;
    status?: "active" | "suspended";
  }>(request);
  if (!body?.userId) return jsonError("Select a user.");
  if (body.userId === user.id) {
    return jsonError("You cannot change your own role or suspend your own account.");
  }

  if (body.role) {
    if (!ROLES.includes(body.role)) return jsonError("Unknown role.");
    const result = updateUserRole(
      body.userId,
      body.role,
      user,
      request.headers.get("x-forwarded-for"),
    );
    if (!result.ok) return jsonError(result.error);
  }

  if (body.status) {
    if (!["active", "suspended"].includes(body.status)) return jsonError("Unknown status.");
    const result = setUserStatus(
      body.userId,
      body.status,
      user,
      request.headers.get("x-forwarded-for"),
    );
    if (!result.ok) return jsonError(result.error);
  }

  return NextResponse.json({ ok: true });
}
