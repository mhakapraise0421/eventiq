import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="Join EventIQ"
      title="From discovery to the front gate."
      subtitle="Create an account to reserve tickets, follow your favourite organizers and keep every order in one place."
    >
      <RegisterForm />
    </AuthShell>
  );
}
