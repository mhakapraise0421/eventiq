"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Send } from "lucide-react";
import { formatDate, formatTime } from "@/lib/format";

export interface BookableArtistOption {
  id: string;
  stageName: string;
  verified: boolean;
}

export interface BookableEventOption {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  venue: string;
  status: string;
}

export function BookingRequestForm({
  artist,
  artists,
  events,
}: {
  artist?: BookableArtistOption;
  artists?: BookableArtistOption[];
  events: BookableEventOption[];
}) {
  const router = useRouter();
  const [artistId, setArtistId] = useState(artist?.id || artists?.[0]?.id || "");
  const [eventId, setEventId] = useState(events[0]?.id || "");
  const [fee, setFee] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const selectedArtist = artist || artists?.find((item) => item.id === artistId);
  const selectedEvent = events.find((item) => item.id === eventId);

  if (!events.length) {
    return (
      <p className="rounded-xl border border-line bg-surface/60 px-3.5 py-3 text-[11.5px] leading-relaxed text-ink-500">
        You need an upcoming event before you can request an artist. Create or publish one in the
        organizer console first.
      </p>
    );
  }

  async function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setPending(true);
    setError(null);
    setSent(false);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          artistId,
          eventId,
          proposedFee: fee,
          message,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "The booking request could not be sent.");
        return;
      }
      setSent(true);
      setFee("");
      setMessage("");
      router.refresh();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {artists ? (
        <label className="block">
          <span className="label">Artist</span>
          <select
            className="input"
            value={artistId}
            onChange={(event) => setArtistId(event.target.value)}
            required
          >
            {artists.map((option) => (
              <option key={option.id} value={option.id}>
                {option.stageName}
                {option.verified ? " · Verified" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-700">
          <CalendarDays className="h-3.5 w-3.5 text-brand-600" />
          Requesting {selectedArtist?.stageName || "this artist"}
        </p>
      )}

      <label className="block">
        <span className="label">Your event</span>
        <select
          className="input"
          value={eventId}
          onChange={(event) => setEventId(event.target.value)}
          required
        >
          {events.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title} · {formatDate(option.starts_at)} {formatTime(option.starts_at)}
            </option>
          ))}
        </select>
      </label>

      {selectedEvent ? (
        <p className="rounded-lg bg-surface/70 px-3 py-2 text-[11px] text-ink-500">
          {selectedEvent.venue} · {formatDate(selectedEvent.starts_at)}{" "}
          {formatTime(selectedEvent.starts_at)}
          {selectedEvent.ends_at ? ` – ${formatTime(selectedEvent.ends_at)}` : ""}
          {selectedEvent.status !== "approved" ? ` · Event is ${selectedEvent.status}` : ""}
        </p>
      ) : null}

      <label className="block">
        <span className="label">Proposed fee (USD, optional)</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-ink-400">
            $
          </span>
          <input
            className="input pl-6"
            inputMode="decimal"
            placeholder="Leave blank to discuss"
            value={fee}
            onChange={(event) => setFee(event.target.value)}
          />
        </div>
      </label>

      <label className="block">
        <span className="label">Message (optional)</span>
        <textarea
          className="input min-h-[90px]"
          maxLength={1000}
          placeholder="Set length, performance notes, soundcheck time, accommodation…"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>

      <p className="text-[10.5px] leading-relaxed text-ink-400">
        A proposed fee is a request to discuss, not a payment or earnings. EventIQ does not process
        artist payments yet; confirmed terms will be recorded in the agreements phase.
      </p>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">
          {error}
        </p>
      ) : null}
      {sent ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-700">
          Request sent. {selectedArtist?.stageName || "The artist"} can accept or decline it from
          their calendar.
        </p>
      ) : null}

      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
        <Send className="h-3.5 w-3.5" /> {pending ? "Sending…" : "Send booking request"}
      </button>
    </form>
  );
}
