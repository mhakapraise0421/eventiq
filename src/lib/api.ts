import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

const MAX_JSON_BYTES = 1024 * 1024;

export async function readJson<T = Record<string, unknown>>(request: Request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_JSON_BYTES) return null;
  try {
    const text = await request.text();
    if (text.length > MAX_JSON_BYTES) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}
