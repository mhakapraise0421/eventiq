"use client";

import { useState } from "react";
import { Bell, CheckCircle2, KeyRound, Mail, Save, ShieldCheck, Smartphone } from "lucide-react";
import { CITIES } from "@/lib/format";

interface ProfileFormProps {
  user: {
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    notify_email?: number;
    notify_sms?: number;
    notify_whatsapp?: number;
  };
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone || "",
    city: user.city || "Harare",
    notifyEmail: user.notify_email !== 0,
    notifySms: user.notify_sms !== 0,
    notifyWhatsapp: user.notify_whatsapp !== 0,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordState, setPasswordState] = useState<"idle" | "saving" | "saved">("idle");
  const [passwordError, setPasswordError] = useState("");

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Could not save your profile.");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3500);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordError("");
    if (passwords.next !== passwords.confirm) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    setPasswordState("saving");
    try {
      const response = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.next,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setPasswordError(data.error || "Could not update your password.");
      } else {
        setPasswordState("saved");
        setPasswords({ current: "", next: "", confirm: "" });
        setTimeout(() => setPasswordState("idle"), 3500);
      }
    } catch {
      setPasswordError("Network error. Please try again.");
    } finally {
      setPasswordState((state) => (state === "saved" ? "saved" : "idle"));
    }
  }

  const inputClass = "input";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={saveProfile} className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em]">
              Personal details
            </h2>
            <p className="mt-1 text-[11.5px] text-ink-400">
              This information appears on your tickets and receipts.
            </p>
          </div>
          {saved ? (
            <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              className={inputClass}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              minLength={2}
              autoComplete="name"
            />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
              <input
                id="email"
                className={`${inputClass} bg-surface/60 pl-9 text-ink-400`}
                value={user.email}
                readOnly
              />
            </div>
            <p className="mt-1 text-[10.5px] text-ink-400">
              Contact support to change your account email.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Phone number
            </label>
            <div className="relative">
              <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
              <input
                id="phone"
                className={`${inputClass} pl-9`}
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="+263 77 000 0000"
                autoComplete="tel"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="city">
              City
            </label>
            <select
              id="city"
              className={inputClass}
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
            >
              <option value="">Select a city</option>
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-950">
            <Bell className="h-3.5 w-3.5 text-brand-600" /> Notification preferences
          </p>
          <p className="mt-1 text-[11px] text-ink-400">
            Choose how you want to hear about ticket confirmations and event updates.
          </p>
          <div className="mt-3 space-y-2">
            {[
              {
                key: "notifyEmail" as const,
                label: "Email",
                hint: "Order confirmations, tickets and receipts",
              },
              {
                key: "notifySms" as const,
                label: "SMS",
                hint: "Event reminders and gate instructions",
              },
              {
                key: "notifyWhatsapp" as const,
                label: "WhatsApp",
                hint: "Last-minute changes and support replies",
              },
            ].map((channel) => (
              <label
                key={channel.key}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3"
              >
                <span>
                  <span className="block text-[12.5px] font-semibold text-ink-900">
                    {channel.label}
                  </span>
                  <span className="mt-0.5 block text-[10.5px] text-ink-400">{channel.hint}</span>
                </span>
                <input
                  type="checkbox"
                  checked={form[channel.key]}
                  onChange={(event) =>
                    setForm({ ...form, [channel.key]: event.target.checked })
                  }
                  className="h-4 w-4 accent-brand-600"
                />
              </label>
            ))}
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex items-center gap-2">
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save changes"}
          </button>
          <span className="text-[10.5px] text-ink-400">
            Your information is only used for ticketing and event updates.
          </span>
        </div>
      </form>

      <div className="space-y-4">
        <form onSubmit={savePassword} className="rounded-2xl border border-line bg-white p-5">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-950">
            <KeyRound className="h-3.5 w-3.5 text-brand-600" /> Change password
          </p>
          <p className="mt-1 text-[11px] text-ink-400">
            Use at least 8 characters. You will stay signed in on this device.
          </p>
          <div className="mt-3 space-y-3">
            <div>
              <label className="label" htmlFor="current-password">
                Current password
              </label>
              <input
                id="current-password"
                type="password"
                className={inputClass}
                value={passwords.current}
                onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
                autoComplete="current-password"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                className={inputClass}
                value={passwords.next}
                onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="confirm-password">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                className={inputClass}
                value={passwords.confirm}
                onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          </div>
          {passwordError ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
              {passwordError}
            </p>
          ) : null}
          {passwordState === "saved" ? (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Password updated
            </p>
          ) : null}
          <button
            type="submit"
            className="btn btn-outline btn-sm mt-4 w-full"
            disabled={passwordState === "saving"}
          >
            {passwordState === "saving" ? "Updating…" : "Update password"}
          </button>
        </form>

        <div className="rounded-2xl border border-line bg-surface/70 p-4">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-900">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-600" /> Account security
          </p>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-400">
            EventIQ never asks for your password over phone, email or WhatsApp. Only enter it
            on this website.
          </p>
        </div>
      </div>
    </div>
  );
}
