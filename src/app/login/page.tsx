import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath =
    params.next && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : undefined;

  return (
    <AuthShell
      eyebrow="Your tickets are waiting"
      title="Every ticket, every gate, one account."
      subtitle="Sign in to see your upcoming events, download QR tickets and access organizer or gate tools."
    >
      <LoginForm nextPath={nextPath} />
    </AuthShell>
  );
}
