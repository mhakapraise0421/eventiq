"use client";

import Link from "next/link";
import { Home, RotateCcw, ShieldCheck } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <div className="w-full max-w-xl rounded-3xl border border-line bg-surface p-8 shadow-sm sm:p-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-600">
          Something went wrong
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
          We hit a snag loading this page.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink-500">
          Nothing has been charged and your tickets are safe. Try again, and if it keeps
          happening, come back in a few minutes or contact support.
        </p>
        {error.digest ? (
          <p className="mt-3 text-[11px] text-ink-400">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={reset} className="btn btn-primary">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
          <Link href="/" className="btn btn-outline">
            <Home className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>
        <p className="mt-8 inline-flex items-center gap-2 text-[11px] text-ink-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
          Payments are only recorded once your provider confirms them.
        </p>
      </div>
    </div>
  );
}
