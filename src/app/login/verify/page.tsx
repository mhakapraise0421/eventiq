import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readMfaChallenge } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { MfaVerifyForm } from "@/components/mfa-verify-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Two-factor verification" };

export default async function LoginVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const challenge = await readMfaChallenge();
  if (!challenge || challenge.purpose !== "mfa") redirect("/login");

  const params = await searchParams;
  const nextPath =
    params.next && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : undefined;

  return (
    <AuthShell
      eyebrow="Account protection"
      title="One more step keeps your account yours."
      subtitle="Two-factor authentication blocks sign-ins that only know your password."
    >
      <MfaVerifyForm nextPath={nextPath} />
    </AuthShell>
  );
}
