import Link from "next/link";
import { CalendarDays, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <div className="w-full max-w-xl rounded-3xl border border-line bg-surface p-8 shadow-sm sm:p-12">
        <p className="font-display text-6xl font-bold tracking-tight text-brand-600">404</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
          We couldn&apos;t find that page.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink-500">
          The link may be broken, or the event may have already happened. Your tickets and
          orders are still available from your dashboard.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/events" className="btn btn-primary">
            <Search className="h-4 w-4" aria-hidden="true" />
            Browse events
          </Link>
          <Link href="/dashboard" className="btn btn-outline">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            My dashboard
          </Link>
          <Link href="/" className="btn btn-ghost">
            <Home className="h-4 w-4" aria-hidden="true" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
