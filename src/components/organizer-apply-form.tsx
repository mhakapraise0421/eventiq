"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, FileText, Send } from "lucide-react";
import { CITIES } from "@/lib/format";

export function OrganizerApplyForm({
  initial,
  resubmitting = false,
}: {
  initial?: {
    business_name: string;
    business_type: string;
    registration_no: string | null;
    city: string | null;
    website: string | null;
    description: string;
    kyc_document: string | null;
  };
  resubmitting?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: initial?.business_name || "",
    businessType: initial?.business_type || "Event promoter",
    registrationNo: initial?.registration_no || "",
    city: initial?.city || "Harare",
    website: initial?.website || "",
    description: initial?.description || "",
    kycDocument: initial?.kyc_document || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/organizer/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Could not submit your application.");
        return;
      }
      router.push("/organizer");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
          Business details
        </h2>
        <p className="mt-1 text-[11px] text-ink-400">
          We only collect what we need to verify you as an organizer.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="businessName">
              Business or promoter name
            </label>
            <input
              id="businessName"
              className="input"
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              placeholder="Chipaz Live"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="businessType">
              Business type
            </label>
            <select
              id="businessType"
              className="input"
              value={form.businessType}
              onChange={(e) => setForm({ ...form, businessType: e.target.value })}
            >
              {[
                "Event promoter",
                "Event management company",
                "Community arts organisation",
                "Church or school",
                "Corporate events team",
                "Venue operator",
                "Other",
              ].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="city">
              City
            </label>
            <select
              id="city"
              className="input"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            >
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="registrationNo">
              Company registration number
            </label>
            <input
              id="registrationNo"
              className="input"
              value={form.registrationNo}
              onChange={(e) => setForm({ ...form, registrationNo: e.target.value })}
              placeholder="ZW-REG-00000"
            />
          </div>
          <div>
            <label className="label" htmlFor="website">
              Website or social page
            </label>
            <input
              id="website"
              className="input"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
          Your events
        </h2>
        <div className="mt-4">
          <label className="label" htmlFor="description">
            Tell us what you organize
          </label>
          <textarea
            id="description"
            className="input min-h-[130px] resize-y"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Types of events, typical venues, audience size and experience…"
            required
          />
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="kycDocument">
            KYC document reference
          </label>
          <div className="relative">
            <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <input
              id="kycDocument"
              className="input pl-9"
              value={form.kycDocument}
              onChange={(e) => setForm({ ...form, kycDocument: e.target.value })}
              placeholder="Certificate of incorporation · file name or secure link"
            />
          </div>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-400">
            Provide a file name or secure link for your certificate of incorporation or
            director ID. Our team will verify it before approving your account.
          </p>
        </div>
      </section>

      <div className="rounded-xl border border-line bg-surface/70 px-4 py-3 text-[10.5px] leading-relaxed text-ink-400">
        By applying you confirm the information is accurate and agree to the EventIQ organizer
        terms, including ticket fee and settlement rules.
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <Send className="h-4 w-4" />
          {saving ? "Submitting…" : resubmitting ? "Resubmit application" : "Submit application"}
        </button>
        <Link href="/organizer" className="btn btn-ghost">
          Back to dashboard
        </Link>
        <span className="ml-auto flex items-center gap-1 text-[10.5px] text-ink-400">
          <BadgeCheck className="h-3 w-3" /> Reviewed by the EventIQ team
        </span>
      </div>
    </form>
  );
}
