"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, FileDown, Loader2 } from "lucide-react";
import { BOOKING_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/format";

type PeriodMode = "month" | "quarter" | "year" | "range";

const REPORT_OPTIONS: {
  value: string;
  label: string;
  mode: PeriodMode;
  hint: string;
}[] = [
  {
    value: "monthly_earnings",
    label: "Monthly earnings report",
    mode: "month",
    hint: "Figures for one whole calendar month.",
  },
  {
    value: "quarterly_earnings",
    label: "Quarterly earnings report",
    mode: "quarter",
    hint: "Figures for one whole calendar quarter.",
  },
  {
    value: "annual_earnings",
    label: "Annual earnings report",
    mode: "year",
    hint: "Figures for one whole calendar year.",
  },
  {
    value: "payment_history",
    label: "Payment history report",
    mode: "range",
    hint: "Every payment record dated inside the period.",
  },
  {
    value: "outstanding_payments",
    label: "Outstanding payments report",
    mode: "range",
    hint: "Open invoice balances due inside the period.",
  },
  {
    value: "booking_performance",
    label: "Booking performance report",
    mode: "range",
    hint: "Requests, confirmations and completed performances.",
  },
  {
    value: "custom_financial",
    label: "Custom financial report",
    mode: "range",
    hint: "Any reporting range up to three years.",
  },
  {
    value: "artist_activity",
    label: "Artist activity report",
    mode: "range",
    hint: "Requests, confirmations, payments and reports generated.",
  },
];

const PAYMENT_OPTIONS = ["all", "received", "recorded", "failed"] as const;
const BOOKING_OPTIONS = ["all", "requested", "accepted", "declined", "withdrawn", "cancelled"] as const;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function harareParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Africa/Harare",
  }).format(date);
  const [year, month, day] = parts.split("-").map(Number);
  return { year, month, day };
}

function dayKey(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function lastDayOfMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return dayKey(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate());
}

function quarterRange(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  return {
    start: dayKey(year, startMonth, 1),
    end: lastDayOfMonth(`${year}-${pad(endMonth)}`),
  };
}

export function ReportGenerator() {
  const router = useRouter();
  const now = harareParts();
  const [reportType, setReportType] = useState("monthly_earnings");
  const [month, setMonth] = useState(`${now.year}-${pad(now.month)}`);
  const [quarter, setQuarter] = useState(Math.floor((now.month - 1) / 3) + 1);
  const [year, setYear] = useState(String(now.year));
  const [from, setFrom] = useState(dayKey(now.year, now.month, 1));
  const [to, setTo] = useState(dayKey(now.year, now.month, now.day));
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [bookingStatus, setBookingStatus] = useState("all");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ reportId: string; sha256: string } | null>(null);

  const option = REPORT_OPTIONS.find((entry) => entry.value === reportType) || REPORT_OPTIONS[0];
  const numericYear = Number(year);

  const period = useMemo(() => {
    if (option.mode === "month") {
      return { start: `${month}-01`, end: lastDayOfMonth(month) };
    }
    if (option.mode === "quarter") {
      return quarterRange(numericYear || now.year, quarter);
    }
    if (option.mode === "year") {
      const chosen = numericYear || now.year;
      return { start: `${chosen}-01-01`, end: `${chosen}-12-31` };
    }
    return { start: from, end: to };
  }, [option.mode, month, quarter, numericYear, from, to, now.year]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setCreated(null);
    try {
      const res = await fetch("/api/artist/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType,
          periodStart: period.start,
          periodEnd: period.end,
          paymentStatus,
          bookingStatus,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        reportId?: string;
        sha256?: string;
      };
      if (!res.ok || !data.reportId || !data.sha256) {
        setError(data.error || "That report could not be generated. Try again.");
        return;
      }
      setCreated({ reportId: data.reportId, sha256: data.sha256 });
      router.refresh();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div>
        <h2 className="font-display text-[15px] font-semibold text-ink-950">Generate a report</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
          Figures are calculated on the server from your own records, then written into a branded
          PDF. The browser never sends financial values.
        </p>
      </div>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block">
          <span className="label">Report type</span>
          <select
            value={reportType}
            onChange={(event) => {
              setReportType(event.target.value);
              setCreated(null);
              setError(null);
            }}
            className="input"
          >
            {REPORT_OPTIONS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[10.5px] text-ink-400">{option.hint}</span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          {option.mode === "month" ? (
            <label className="block">
              <span className="label">Month</span>
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="input"
                required
              />
            </label>
          ) : null}

          {option.mode === "quarter" ? (
            <>
              <label className="block">
                <span className="label">Year</span>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  className="input"
                  required
                />
              </label>
              <label className="block">
                <span className="label">Quarter</span>
                <select
                  value={quarter}
                  onChange={(event) => setQuarter(Number(event.target.value))}
                  className="input"
                >
                  <option value={1}>Q1 · January to March</option>
                  <option value={2}>Q2 · April to June</option>
                  <option value={3}>Q3 · July to September</option>
                  <option value={4}>Q4 · October to December</option>
                </select>
              </label>
            </>
          ) : null}

          {option.mode === "year" ? (
            <label className="block">
              <span className="label">Year</span>
              <input
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="input"
                required
              />
            </label>
          ) : null}

          {option.mode === "range" ? (
            <>
              <label className="block">
                <span className="label">From</span>
                <input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="input"
                  required
                />
              </label>
              <label className="block">
                <span className="label">To</span>
                <input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="input"
                  required
                />
              </label>
            </>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Payment status</span>
            <select
              value={paymentStatus}
              onChange={(event) => setPaymentStatus(event.target.value)}
              className="input"
            >
              {PAYMENT_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "All payment records" : PAYMENT_STATUS_LABEL[value] || value}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Booking status</span>
            <select
              value={bookingStatus}
              onChange={(event) => setBookingStatus(event.target.value)}
              className="input"
            >
              {BOOKING_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "All bookings" : BOOKING_STATUS_LABEL[value] || value}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface/60 px-3 py-2.5">
          <span className="text-[10.5px] text-ink-500">
            Reporting period:{" "}
            <strong className="font-semibold text-ink-700">
              {period.start} to {period.end}
            </strong>
          </span>
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <FileDown className="h-3.5 w-3.5" /> Generate PDF
              </>
            )}
          </button>
        </div>

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] text-rose-700">
            {error}
          </p>
        ) : null}

        {created ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[11px] text-emerald-800">
            <p className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" /> Report generated
            </p>
            <p className="mt-1 font-mono text-[10px] text-emerald-700">{created.reportId}</p>
            <p className="mt-0.5 break-all font-mono text-[9.5px] text-emerald-700/80">
              SHA-256 {created.sha256}
            </p>
            <Link
              href={`/api/artist/reports/${created.reportId}/download`}
              className="btn btn-sm btn-outline mt-2 bg-white"
            >
              <FileDown className="h-3.5 w-3.5" /> Download PDF
            </Link>
          </div>
        ) : null}
      </form>
    </div>
  );
}
