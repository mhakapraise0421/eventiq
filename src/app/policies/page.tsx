import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";
import { POLICIES } from "@/lib/policies";

export const metadata: Metadata = { title: "Policy centre" };

export default function PoliciesPage() {
  return (
    <div className="bg-white pb-20">
      <div className="border-b border-line bg-surface/60">
        <div className="container-page max-w-4xl py-12">
          <p className="eyebrow">Trust & safety</p>
          <h1 className="mt-2 font-display text-[34px] font-semibold tracking-[-0.04em] text-ink-950 md:text-[42px]">
            Policy centre
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-500">
            Clear rules for buying, selling and scanning tickets on EventIQ. Every policy explains
            what you can expect from us and what we ask of attendees and organizers.
          </p>
        </div>
      </div>

      <div className="container-page max-w-4xl pt-8">
        <div className="grid gap-3 sm:grid-cols-2">
          {POLICIES.map((policy) => (
            <Link
              key={policy.slug}
              href={`/policies/${policy.slug}`}
              className="group rounded-2xl border border-line bg-white p-4 transition hover:border-brand-200 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <FileText className="h-4 w-4" />
                </div>
                <ArrowRight className="h-4 w-4 text-ink-300 transition group-hover:text-brand-600" />
              </div>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                {policy.eyebrow}
              </p>
              <h2 className="mt-1 font-display text-[15.5px] font-semibold tracking-[-0.02em] text-ink-950">
                {policy.title}
              </h2>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-500">{policy.summary}</p>
              <p className="mt-3 text-[10px] text-ink-300">Updated {policy.updated}</p>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-line bg-surface/60 px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <p className="text-[11.5px] leading-relaxed text-ink-500">
            Questions about a policy? Email{" "}
            <a href="mailto:support@eventiq.co.zw" className="font-semibold text-brand-700">
              support@eventiq.co.zw
            </a>
            . This deployment is a demonstration environment — payments are simulated and no real
            card details are collected.
          </p>
        </div>
      </div>
    </div>
  );
}
