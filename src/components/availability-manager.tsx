"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Trash2 } from "lucide-react";
import { formatDateTime, harareInputToISO } from "@/lib/format";
import type { ArtistAvailability } from "@/lib/types";

export function AvailabilityManager({ blocks }: { blocks: ArtistAvailability[] }) {
  const router = useRouter();
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function add(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/artist/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          startsAt: startsAt ? harareInputToISO(startsAt) : "",
          endsAt: endsAt ? harareInputToISO(endsAt) : "",
          note,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "That unavailable block could not be saved.");
        return;
      }
      setStartsAt("");
      setEndsAt("");
      setNote("");
      router.refresh();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this unavailable block?")) return;
    setRemoving(id);
    setError(null);
    try {
      const res = await fetch("/api/artist/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", availabilityId: id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "That block could not be removed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      return;
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Unavailable from</span>
            <input
              type="datetime-local"
              className="input"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="label">Until</span>
            <input
              type="datetime-local"
              className="input"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              required
            />
          </label>
        </div>
        <label className="block">
          <span className="label">Private note (optional)</span>
          <input
            className="input"
            maxLength={200}
            placeholder="e.g. Studio rehearsals — only you can see this"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <p className="text-[10.5px] text-ink-400">
          Times are Africa/Harare (CAT). Organizers cannot request a booking that overlaps a block,
          and you cannot accept one either.
        </p>
        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          <CalendarPlus className="h-3.5 w-3.5" /> {pending ? "Saving…" : "Block these dates"}
        </button>
      </form>

      <div className="border-t border-line pt-3">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-400">
          Saved unavailable periods
        </p>
        {blocks.length ? (
          <ul className="mt-2 space-y-1.5">
            {blocks.map((block) => (
              <li
                key={block.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface/50 px-3 py-2"
              >
                <div>
                  <p className="text-[11.5px] font-semibold text-ink-800">
                    {formatDateTime(block.starts_at)} – {formatDateTime(block.ends_at)}
                  </p>
                  {block.note ? (
                    <p className="text-[10.5px] text-ink-400">{block.note}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => remove(block.id)}
                  disabled={removing === block.id}
                  className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-ink-400 hover:text-rose-600"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[11px] text-ink-400">No unavailable periods saved yet.</p>
        )}
      </div>
    </div>
  );
}
