"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  Image as ImageIcon,
  Link2,
  ListMusic,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { ARTIST_CATEGORIES, ARTIST_REGIONS, MAX_ARTIST_MEDIA_LINKS } from "@/lib/artist-options";
import { CITIES } from "@/lib/format";
import type { ArtistMediaLink } from "@/lib/types";
import { ArtistGenrePicker } from "./artist-genre-picker";

export interface ArtistProfileFormValues {
  stageName: string;
  category: string;
  genres: string[];
  bio: string;
  city: string;
  region: string;
  profileImage: string;
  coverImage: string;
  website: string;
  instagram: string;
  facebook: string;
  x: string;
  tiktok: string;
  youtube: string;
  media: ArtistMediaLink[];
  performanceHistory: string;
  availabilityNote: string;
  bookingPrefs: string;
  technicalRider: string;
}

export function ArtistProfileForm({
  initial,
  visibility,
  gaps,
  justCreated = false,
}: {
  initial: ArtistProfileFormValues;
  visibility: "draft" | "published";
  gaps: string[];
  justCreated?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ArtistProfileFormValues>(initial);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function post(action: "save" | "publish" | "unpublish") {
    setBusy(action);
    setError("");
    setDone("");
    try {
      const response = await fetch("/api/artist/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...form }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Could not save your profile.");
        return;
      }
      setDone(
        action === "publish"
          ? "Profile published to the artist directory."
          : action === "unpublish"
            ? "Profile hidden from the public directory."
            : "Profile saved.",
      );
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy("");
    }
  }

  function setMedia(index: number, patch: Partial<ArtistMediaLink>) {
    setForm({
      ...form,
      media: form.media.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void post("save");
      }}
    >
      {justCreated ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-[12px] leading-relaxed text-emerald-800">
          Your artist profile was created as a draft. Add your links and a fuller biography, then
          publish it to appear in the directory.
        </div>
      ) : null}

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-semibold tracking-[-0.02em]">
          <ListMusic className="h-4 w-4 text-brand-600" /> Identity
        </h2>
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
              <option value="">Not set</option>
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
              <option value="">Not set</option>
              {ARTIST_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="profileImage">
              Profile image URL
            </label>
            <input
              id="profileImage"
              className="input"
              value={form.profileImage}
              onChange={(e) => setForm({ ...form, profileImage: e.target.value })}
              placeholder="https://"
            />
          </div>
          <div>
            <label className="label" htmlFor="coverImage">
              Cover image URL
            </label>
            <input
              id="coverImage"
              className="input"
              value={form.coverImage}
              onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
              placeholder="https://"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
          About and genres
        </h2>
        <div className="mt-4">
          <span className="label">Genres and specialties</span>
          <ArtistGenrePicker
            value={form.genres}
            onChange={(genres) => setForm({ ...form, genres })}
          />
        </div>
        <div className="mt-4">
          <label className="label" htmlFor="bio">
            Biography
          </label>
          <textarea
            id="bio"
            className="input min-h-[150px] resize-y"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            required
          />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-semibold tracking-[-0.02em]">
          <Link2 className="h-4 w-4 text-brand-600" /> Links
        </h2>
        <p className="mt-1 text-[11px] text-ink-400">
          These links are shown on your public profile. Full URLs only.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(
            [
              ["website", "Website"],
              ["instagram", "Instagram"],
              ["facebook", "Facebook"],
              ["x", "X / Twitter"],
              ["tiktok", "TikTok"],
              ["youtube", "YouTube"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="label" htmlFor={key}>
                {label}
              </label>
              <input
                id={key}
                className="input"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder="https://"
              />
            </div>
          ))}
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <span className="label mb-0">Music and video links</span>
            {form.media.length < MAX_ARTIST_MEDIA_LINKS ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700"
                onClick={() =>
                  setForm({ ...form, media: [...form.media, { label: "", url: "" }] })
                }
              >
                <Plus className="h-3 w-3" /> Add link
              </button>
            ) : null}
          </div>
          <div className="mt-2 space-y-2">
            {form.media.map((item, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <input
                  className="input w-full max-w-[180px] text-[12px]"
                  value={item.label}
                  onChange={(e) => setMedia(index, { label: e.target.value })}
                  placeholder="Label (e.g. Latest single)"
                />
                <input
                  className="input min-w-0 flex-1 text-[12px]"
                  value={item.url}
                  onChange={(e) => setMedia(index, { url: e.target.value })}
                  placeholder="https://"
                />
                <button
                  type="button"
                  aria-label="Remove link"
                  className="text-ink-400 hover:text-rose-600"
                  onClick={() =>
                    setForm({ ...form, media: form.media.filter((_, i) => i !== index) })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {!form.media.length ? (
              <p className="text-[10.5px] text-ink-400">No media links added yet.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-semibold tracking-[-0.02em]">
          <ImageIcon className="h-4 w-4 text-brand-600" /> Performance details
        </h2>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="label" htmlFor="performanceHistory">
              Performance history
            </label>
            <textarea
              id="performanceHistory"
              className="input min-h-[90px] resize-y"
              value={form.performanceHistory}
              onChange={(e) => setForm({ ...form, performanceHistory: e.target.value })}
              placeholder="Notable shows, venues, festivals and collaborations…"
            />
          </div>
          <div>
            <label className="label" htmlFor="availabilityNote">
              Availability (public)
            </label>
            <input
              id="availabilityNote"
              className="input"
              value={form.availabilityNote}
              onChange={(e) => setForm({ ...form, availabilityNote: e.target.value })}
              placeholder="Weekends, touring from November…"
            />
          </div>
          <div>
            <label className="label" htmlFor="technicalRider">
              Technical rider (public)
            </label>
            <textarea
              id="technicalRider"
              className="input min-h-[90px] resize-y"
              value={form.technicalRider}
              onChange={(e) => setForm({ ...form, technicalRider: e.target.value })}
              placeholder="Sound, stage, backline and timing requirements…"
            />
          </div>
          <div>
            <label className="label" htmlFor="bookingPrefs">
              Booking preferences (private)
            </label>
            <textarea
              id="bookingPrefs"
              className="input min-h-[90px] resize-y"
              value={form.bookingPrefs}
              onChange={(e) => setForm({ ...form, bookingPrefs: e.target.value })}
              placeholder="Travel expectations, deposit terms, blackout dates…"
            />
            <p className="mt-1.5 text-[10.5px] text-ink-400">
              Private notes are never shown on your public profile.
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-700">
          {done}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn btn-primary" disabled={!!busy}>
          <Save className="h-4 w-4" /> {busy === "save" ? "Saving…" : "Save changes"}
        </button>
        {visibility === "draft" ? (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => post("publish")}
            disabled={!!busy}
          >
            <Eye className="h-4 w-4" /> {busy === "publish" ? "Publishing…" : "Publish profile"}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => post("unpublish")}
            disabled={!!busy}
          >
            <EyeOff className="h-4 w-4" /> {busy === "unpublish" ? "Hiding…" : "Unpublish"}
          </button>
        )}
        <Link href="/artist" className="btn btn-ghost">
          Back to dashboard
        </Link>
        {gaps.length ? (
          <span className="text-[10.5px] text-amber-700">
            To publish: {gaps.join(" · ").toLowerCase()}
          </span>
        ) : null}
      </div>
    </form>
  );
}
