"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

const DEMO_ACCOUNTS = [
  { email: "attendee@eventiq.co.zw", label: "Attendee", hint: "Tickets & orders" },
  { email: "organizer@eventiq.co.zw", label: "Organizer", hint: "Events & sales" },
  { email: "gate@eventiq.co.zw", label: "Gate staff", hint: "Scanner & admissions" },
  { email: "admin@eventiq.co.zw", label: "Administrator", hint: "Approvals & reports" },
  { email: "ceo@eventiq.co.zw", label: "CEO", hint: "Oversight & approvals" },
];

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not sign in.");
        setLoading(false);
        return;
      }
      router.push(nextPath || data.redirect || "/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="eyebrow">Welcome back</p>
      <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.035em]">
        Sign in to EventIQ
      </h1>
      <p className="mt-1.5 text-[13px] text-ink-500">
        Access your tickets, organizer tools or the gate scanner.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="label">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="label">Password</label>
            <span className="mb-1.5 text-[11px] text-ink-400">Demo: demo1234</span>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        ) : null}

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p className="mt-4 text-center text-[12px] text-ink-400">
        New to EventIQ?{" "}
        <Link href="/register" className="font-semibold text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-6 rounded-xl border border-line bg-surface/60 p-3">
        <p className="px-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-400">
          Demo accounts · password demo1234
        </p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword("demo1234");
                setError("");
              }}
              className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-2 text-left ring-1 ring-line transition hover:ring-brand-300"
            >
              <span>
                <span className="block text-[11px] font-semibold text-ink-900">
                  {account.label}
                </span>
                <span className="block text-[9.5px] text-ink-400">{account.hint}</span>
              </span>
              <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold text-brand-700">
                Use
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
