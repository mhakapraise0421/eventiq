"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BookingOption = {
  id: string;
  artist_stage_name: string;
  event_title: string;
  proposed_fee_cents: number | null;
};

export type AgreementInitial = {
  feeCents: number;
  depositCents: number;
  depositDueOn: string | null;
  balanceDueOn: string | null;
  cancellationTerms: string | null;
  transportArrangements: string | null;
  accommodationArrangements: string | null;
  technicalRequirements: string | null;
  responsibilities: string | null;
  additionalConditions: string | null;
};

const money = (cents: number) => (cents > 0 ? (cents / 100).toString() : "");

export function AgreementForm({
  mode,
  agreementId,
  bookings = [],
  initial,
}: {
  mode: "create" | "edit" | "amend";
  agreementId?: string;
  bookings?: BookingOption[];
  initial?: AgreementInitial;
}) {
  const router = useRouter();
  const [bookingId, setBookingId] = useState(bookings[0]?.id || "");
  const [fee, setFee] = useState(initial ? money(initial.feeCents) : money(bookings[0]?.proposed_fee_cents || 0));
  const [deposit, setDeposit] = useState(initial ? money(initial.depositCents) : "");
  const [depositDueOn, setDepositDueOn] = useState(initial?.depositDueOn || "");
  const [balanceDueOn, setBalanceDueOn] = useState(initial?.balanceDueOn || "");
  const [cancellationTerms, setCancellationTerms] = useState(initial?.cancellationTerms || "");
  const [transportArrangements, setTransportArrangements] = useState(
    initial?.transportArrangements || "",
  );
  const [accommodationArrangements, setAccommodationArrangements] = useState(
    initial?.accommodationArrangements || "",
  );
  const [technicalRequirements, setTechnicalRequirements] = useState(
    initial?.technicalRequirements || "",
  );
  const [responsibilities, setResponsibilities] = useState(initial?.responsibilities || "");
  const [additionalConditions, setAdditionalConditions] = useState(
    initial?.additionalConditions || "",
  );
  const [changeSummary, setChangeSummary] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function chooseBooking(id: string) {
    setBookingId(id);
    const booking = bookings.find((entry) => entry.id === id);
    if (booking) setFee(money(booking.proposed_fee_cents || 0));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    const payload = {
      bookingId,
      fee,
      deposit,
      depositDueOn,
      balanceDueOn,
      cancellationTerms,
      transportArrangements,
      accommodationArrangements,
      technicalRequirements,
      responsibilities,
      additionalConditions,
      changeSummary,
    };

    try {
      const res = await fetch(
        mode === "create" ? "/api/agreements" : `/api/agreements/${agreementId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mode === "create" ? payload : { action: "save", ...payload }),
        },
      );
      const data = (await res.json()) as { error?: string; agreementId?: string };
      if (!res.ok) {
        setError(data.error || "That agreement could not be saved.");
        return;
      }
      if (mode === "create" && data.agreementId) {
        router.push(`/organizer/agreements/${data.agreementId}`);
        return;
      }
      setMessage(
        mode === "amend"
          ? "Amendment draft saved. Review it, then send it to the artist."
          : "Draft saved.",
      );
      router.refresh();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (mode === "create" && !bookings.length) {
    return (
      <p className="rounded-xl border border-line bg-surface/60 px-3.5 py-3 text-[11.5px] leading-relaxed text-ink-500">
        Every confirmed booking already has an agreement. Confirm another booking first.
      </p>
    );
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      {mode === "create" ? (
        <label className="block">
          <span className="label">Confirmed booking</span>
          <select
            className="input"
            value={bookingId}
            onChange={(event) => chooseBooking(event.target.value)}
            required
          >
            {bookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {booking.artist_stage_name} — {booking.event_title}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Agreed fee (USD)</span>
          <input
            className="input"
            inputMode="decimal"
            value={fee}
            onChange={(event) => setFee(event.target.value)}
            placeholder="1200"
            required
          />
        </label>
        <label className="block">
          <span className="label">Deposit (USD, optional)</span>
          <input
            className="input"
            inputMode="decimal"
            value={deposit}
            onChange={(event) => setDeposit(event.target.value)}
            placeholder="400"
          />
        </label>
        <label className="block">
          <span className="label">Deposit due</span>
          <input
            type="date"
            className="input"
            value={depositDueOn}
            onChange={(event) => setDepositDueOn(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Balance due</span>
          <input
            type="date"
            className="input"
            value={balanceDueOn}
            onChange={(event) => setBalanceDueOn(event.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className="label">Cancellation and postponement terms</span>
        <textarea
          className="input min-h-[64px]"
          maxLength={2000}
          value={cancellationTerms}
          onChange={(event) => setCancellationTerms(event.target.value)}
          placeholder="Notice periods, deposits retained, rescheduling rules."
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Transport arrangements</span>
          <textarea
            className="input min-h-[56px]"
            maxLength={2000}
            value={transportArrangements}
            onChange={(event) => setTransportArrangements(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Accommodation arrangements</span>
          <textarea
            className="input min-h-[56px]"
            maxLength={2000}
            value={accommodationArrangements}
            onChange={(event) => setAccommodationArrangements(event.target.value)}
          />
        </label>
      </div>
      <label className="block">
        <span className="label">Technical requirements</span>
        <textarea
          className="input min-h-[56px]"
          maxLength={2000}
          value={technicalRequirements}
          onChange={(event) => setTechnicalRequirements(event.target.value)}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Responsibilities</span>
          <textarea
            className="input min-h-[56px]"
            maxLength={2000}
            value={responsibilities}
            onChange={(event) => setResponsibilities(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Additional conditions</span>
          <textarea
            className="input min-h-[56px]"
            maxLength={2000}
            value={additionalConditions}
            onChange={(event) => setAdditionalConditions(event.target.value)}
          />
        </label>
      </div>

      {mode === "amend" ? (
        <label className="block">
          <span className="label">What changed in this amendment?</span>
          <textarea
            className="input min-h-[56px]"
            maxLength={2000}
            value={changeSummary}
            onChange={(event) => setChangeSummary(event.target.value)}
            placeholder="The artist reviews this before accepting the new version."
            required
          />
        </label>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {mode === "create" ? "Create draft" : "Save draft"}
        </button>
        <span className="text-[10.5px] leading-relaxed text-ink-400">
          Money is stored in integer cents. Drafts are private until you send them.
        </span>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-700">
          {message}
        </p>
      ) : null}
    </form>
  );
}
