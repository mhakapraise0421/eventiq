"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ImagePlus, Plus, Save, Trash2 } from "lucide-react";
import { CATEGORIES, CITIES, harareInputToISO, isoToHarareInput } from "@/lib/format";

interface TierDraft {
  key: string;
  name: string;
  description: string;
  price: string;
  capacity: string;
  maxPerOrder: string;
  perks: string;
}

interface EventDraft {
  id: string;
  title: string;
  tagline: string | null;
  description: string;
  category: string;
  city: string;
  venue: string;
  address: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_image: string | null;
  age_limit: string | null;
  terms: string | null;
}

export function OrganizerEventForm({
  mode,
  event,
  tiers,
}: {
  mode: "create" | "edit";
  event?: EventDraft;
  tiers?: Array<{
    name: string;
    description: string | null;
    price_cents: number;
    capacity: number;
    max_per_order: number;
    perks: string | null;
  }>;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: event?.title || "",
    tagline: event?.tagline || "",
    description: event?.description || "",
    category: event?.category || CATEGORIES[0],
    city: event?.city || CITIES[0],
    venue: event?.venue || "",
    address: event?.address || "",
    startsAt: isoToHarareInput(event?.starts_at) || "",
    endsAt: isoToHarareInput(event?.ends_at) || "",
    coverImage: event?.cover_image || "",
    ageLimit: event?.age_limit || "",
    terms: event?.terms || "",
  });

  const [tierList, setTierList] = useState<TierDraft[]>(
    tiers?.length
      ? tiers.map((tier, index) => ({
          key: `existing-${index}`,
          name: tier.name,
          description: tier.description || "",
          price: String(tier.price_cents / 100),
          capacity: String(tier.capacity),
          maxPerOrder: String(tier.max_per_order),
          perks: tier.perks || "",
        }))
      : [
          {
            key: "tier-1",
            name: "General Admission",
            description: "Standard entry to the event.",
            price: "20",
            capacity: "200",
            maxPerOrder: "6",
            perks: "",
          },
        ],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateTier(key: string, patch: Partial<TierDraft>) {
    setTierList((list) =>
      list.map((tier) => (tier.key === key ? { ...tier, ...patch } : tier)),
    );
  }

  function addTier() {
    if (tierList.length >= 8) return;
    setTierList((list) => [
      ...list,
      {
        key: `tier-${Date.now()}`,
        name: "",
        description: "",
        price: "50",
        capacity: "50",
        maxPerOrder: "4",
        perks: "",
      },
    ]);
  }

  async function submit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      title: form.title,
      tagline: form.tagline,
      description: form.description,
      category: form.category,
      city: form.city,
      venue: form.venue,
      address: form.address,
      startsAt: form.startsAt ? harareInputToISO(form.startsAt) : "",
      endsAt: form.endsAt ? harareInputToISO(form.endsAt) : "",
      coverImage: form.coverImage,
      ageLimit: form.ageLimit,
      terms: form.terms,
      tiers: tierList.map((tier) => ({
        name: tier.name,
        description: tier.description,
        priceCents: Math.round((Number(tier.price) || 0) * 100),
        capacity: Math.round(Number(tier.capacity) || 0),
        maxPerOrder: Math.round(Number(tier.maxPerOrder) || 6),
        perks: tier.perks,
      })),
    };

    try {
      const response = await fetch(
        mode === "create"
          ? "/api/organizer/events"
          : `/api/organizer/events/${event?.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as { error?: string; eventId?: string };
      if (!response.ok) {
        setError(data.error || "Could not save this event.");
        return;
      }
      const targetId = data.eventId || event?.id;
      router.push(targetId ? `/organizer/events/${targetId}` : "/organizer/events");
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
          Event details
        </h2>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="label" htmlFor="title">
              Event title
            </label>
            <input
              id="title"
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Neon Nights: Harare"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="tagline">
              Short tagline
            </label>
            <input
              id="tagline"
              className="input"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              placeholder="One line that sells the night"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
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
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ageLimit">
                Age restriction
              </label>
              <input
                id="ageLimit"
                className="input"
                value={form.ageLimit}
                onChange={(e) => setForm({ ...form, ageLimit: e.target.value })}
                placeholder="18+ or leave blank"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
          When & where
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="startsAt">
              Starts
            </label>
            <input
              id="startsAt"
              type="datetime-local"
              className="input"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="endsAt">
              Ends
            </label>
            <input
              id="endsAt"
              type="datetime-local"
              className="input"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
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
            <label className="label" htmlFor="venue">
              Venue
            </label>
            <input
              id="venue"
              className="input"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
              placeholder="HICC Arena"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="address">
              Address
            </label>
            <input
              id="address"
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Samora Machel Avenue, Harare CBD"
            />
          </div>
        </div>
        <p className="mt-2 text-[10.5px] text-ink-400">
          Times are entered in Central Africa Time (CAT, UTC+2).
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
              Ticket types
            </h2>
            <p className="mt-1 text-[11px] text-ink-400">
              Set prices, capacity and purchase limits for each tier.
            </p>
          </div>
          <button type="button" onClick={addTier} className="btn btn-outline btn-sm">
            <Plus className="h-3.5 w-3.5" /> Add tier
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {tierList.map((tier, index) => (
            <div key={tier.key} className="rounded-xl border border-line bg-surface/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  Ticket type {index + 1}
                </p>
                {tierList.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setTierList((list) => list.filter((item) => item.key !== tier.key))
                    }
                    className="flex items-center gap-1 text-[10.5px] font-semibold text-rose-600"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Name</label>
                  <input
                    className="input"
                    value={tier.name}
                    onChange={(e) => updateTier(tier.key, { name: e.target.value })}
                    placeholder="VIP"
                    required
                  />
                </div>
                <div>
                  <label className="label">Perks / note</label>
                  <input
                    className="input"
                    value={tier.perks}
                    onChange={(e) => updateTier(tier.key, { perks: e.target.value })}
                    placeholder="Fast-lane entry · 1 free drink"
                  />
                </div>
                <div>
                  <label className="label">Price (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input"
                    value={tier.price}
                    onChange={(e) => updateTier(tier.key, { price: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Capacity</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="input"
                    value={tier.capacity}
                    onChange={(e) => updateTier(tier.key, { capacity: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Max per order</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    className="input"
                    value={tier.maxPerOrder}
                    onChange={(e) => updateTier(tier.key, { maxPerOrder: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Description</label>
                  <input
                    className="input"
                    value={tier.description}
                    onChange={(e) => updateTier(tier.key, { description: e.target.value })}
                    placeholder="What this ticket includes"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em]">
          Story & cover
        </h2>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="label" htmlFor="description">
              Event description
            </label>
            <textarea
              id="description"
              className="input min-h-[140px] resize-y"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Line-up, schedule, what guests can expect…"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="coverImage">
              Cover image URL
            </label>
            <div className="relative">
              <ImagePlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
              <input
                id="coverImage"
                className="input pl-9"
                value={form.coverImage}
                onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                placeholder="Leave blank to generate artwork automatically"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="terms">
              Ticket terms
            </label>
            <textarea
              id="terms"
              className="input min-h-[80px] resize-y"
              value={form.terms}
              onChange={(e) => setForm({ ...form, terms: e.target.value })}
              placeholder="Entry conditions, refund rules, ID requirements…"
            />
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white/95 p-3 shadow-sm backdrop-blur">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : mode === "create" ? "Save draft event" : "Save changes"}
        </button>
        <Link
          href={mode === "create" ? "/organizer/events" : `/organizer/events/${event?.id}`}
          className="btn btn-ghost"
        >
          Cancel
        </Link>
        <span className="ml-auto text-[10.5px] text-ink-400">
          Drafts stay private until you submit them for review.
        </span>
      </div>
    </form>
  );
}
