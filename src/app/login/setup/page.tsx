import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readMfaChallenge } from "@/lib/auth";
import { hasConfirmedMfa } from "@/lib/mfa";
import { AuthShell } from "@/components/auth-shell";
import { MfaEnrollForm } from "@/components/mfa-enroll-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up two-factor authentication" };

export default async function LoginSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const challenge = await readMfaChallenge();
  if (!challenge || challenge.purpose !== "enroll") redirect("/login");
  if (hasConfirmedMfa(challenge.uid)) redirect("/login/verify");

  const params = await searchParams;
  const nextPath =
    params.next && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : undefined;

  return (
    <AuthShell
      eyebrow="Before you continue"
      title="Protect the console that holds your calendar and earnings."
      subtitle="Artist and staff accounts need an authenticator app before using their console. Use any app that generates six-digit codes, such as Google Authenticator or Authy."
    >
      <MfaEnrollForm mode="challenge" nextPath={nextPath} />
    </AuthShell>
  );
}
