import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { sameOrigin } from "@/lib/api";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
