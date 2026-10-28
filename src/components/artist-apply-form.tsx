"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Mic, Send } from "lucide-react";
import { ARTIST_CATEGORIES, ARTIST_REGIONS } from "@/lib/artist-options";
import { CITIES } from "@/lib/format";
import { ArtistGenrePicker } from "./artist-genre-picker";

export function ArtistApplyForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    stageName: "",
    category: "Musician",
    genres: [] as string[],
    bio: "",
    city: "Harare",
    region: "Harare",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/artist/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Could not create your artist profile.");
        return;
      }
      router.push("/artist/profile?created=1");
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
        <h2 className="flex items-center gap-2 font-display text-[16px] font-semibold tracking-[-0.02em]">
          <Mic className="h-4 w-4 text-brand-600" /> Your act
        </h2>
        <p className="mt-1 text-[11px] text-ink-400">
          Start with the basics. You can add photos, links, a rider and booking preferences after
          your profile is created.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="stageName">
              Artist or stage name
            </label>
            <input
              id="stageName"
              className="input"
              value={form.stageName}
              onChange={(e) => setForm({ ...form, stageName: e.target.value })}
              placeholder="TAFARA"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {ARTIST_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="city">
              Base city
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
            <label className="label" htmlFor="region">
              Operating region
            </label>
            <select
              id="region"
              className="input"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
            >
              {ARTIST_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <span className="label">Genres and specialties</span>
            <ArtistGenrePicker
              value={form.genres}
              onChange={(genres) => setForm({ ...form, genres })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="bio">
              Short biography
            </label>
            <textarea
              id="bio"
              className="input min-h-[130px] resize-y"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Who you are, what you perform, and where you have played…"
              required
            />
            <p className="mt-1.5 text-[10.5px] text-ink-400">
              At least 40 characters now; you will expand this before publishing.
            </p>
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-line bg-surface/70 px-4 py-3 text-[10.5px] leading-relaxed text-ink-400">
        Creating a profile starts a draft that only you can see. Publishing makes it visible in the
        public artist directory. Identity verification is a separate step and is never automatic.
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <Send className="h-4 w-4" />
          {saving ? "Creating profile…" : "Create artist profile"}
        </button>
        <Link href="/artists" className="btn btn-ghost">
          Browse the directory <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <span className="ml-auto flex items-center gap-1 text-[10.5px] text-ink-400">
          <BadgeCheck className="h-3 w-3" /> Verified profiles reviewed by EventIQ
        </span>
      </div>
    </form>
  );
}
