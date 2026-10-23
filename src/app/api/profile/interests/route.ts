import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { setUserInterests } from "@/lib/attendee";
import { writeAudit } from "@/lib/audit";
import { jsonError, readJson, sameOrigin } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Please sign in.", 401);

  const limited = rateLimit(`interests:${user.id}`, 10, 60_000);
  if (!limited.ok) return jsonError("Too many requests. Please slow down.", 429);

  const body = await readJson<{ categories?: unknown }>(request);
  if (!body || !Array.isArray(body.categories)) {
    return jsonError("Invalid request.");
  }
  const categories = body.categories
    .filter((category): category is string => typeof category === "string")
    .slice(0, 6);

  const saved = setUserInterests(user.id, categories);
  if (saved.length !== categories.length) {
    return jsonError("Some selected interests are not recognised.");
  }

  writeAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: "profile.interests_updated",
    entityType: "user",
    entityId: user.id,
    after: { categories: saved },
    ip: request.headers.get("x-forwarded-for"),
  });

  return NextResponse.json({ ok: true, categories: saved });
}
