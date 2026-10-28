import { NextResponse } from "next/server";
import { destroyCurrentSession } from "@/lib/auth";
import { sameOrigin } from "@/lib/api";

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  await destroyCurrentSession("logout");
  return NextResponse.redirect(new URL("/", request.url), 303);
}
