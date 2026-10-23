"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: "Harare",
    password: "",
  });
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accepted) {
      setError("Please accept the Terms and Privacy Policy.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not create your account.");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="eyebrow">Create your account</p>
      <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.035em]">
        Book your next event
      </h1>
      <p className="mt-1.5 text-[13px] text-ink-500">
        Tickets, orders and receipts in one place — no printing required.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3.5">
        <div>
          <label htmlFor="name" className="label">Full name</label>
          <input
            id="name"
            required
            minLength={2}
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Tino Moyo"
            className="input"
            autoComplete="name"
          />
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@example.com"
              className="input"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="phone" className="label">Phone (optional)</label>
            <input
              id="phone"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+263 77 000 0000"
              className="input"
              autoComplete="tel"
            />
          </div>
        </div>
        <div>
          <label htmlFor="city" className="label">City</label>
          <select
            id="city"
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            className="input"
          >
            <option>Harare</option>
            <option>Bulawayo</option>
            <option>Victoria Falls</option>
            <option>Mutare</option>
            <option>Gweru</option>
            <option>Masvingo</option>
          </select>
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            placeholder="At least 8 characters"
            className="input"
            autoComplete="new-password"
          />
        </div>

        <label className="flex items-start gap-2 text-[11.5px] leading-relaxed text-ink-500">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-line accent-brand-600"
          />
          I agree to the{" "}
          <Link href="/policies/terms" className="font-medium text-brand-700 underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/policies/privacy" className="font-medium text-brand-700 underline">
            Privacy Policy
          </Link>
          .
        </label>

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        ) : null}

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Creating account…
            </>
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-[12px] text-ink-400">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
