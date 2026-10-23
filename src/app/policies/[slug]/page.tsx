import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { getPolicy, POLICIES } from "@/lib/policies";

export function generateStaticParams() {
  return POLICIES.map((policy) => ({ slug: policy.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const policy = getPolicy(slug);
  if (!policy) return { title: "Policy not found" };
  return { title: policy.title, description: policy.summary };
}

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const policy = getPolicy(slug);
  if (!policy) notFound();

  return (
    <div className="bg-white pb-20">
      <div className="border-b border-line bg-surface/60">
        <div className="container-page max-w-3xl py-10">
          <Link
            href="/policies"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Policy centre
          </Link>
          <p className="eyebrow mt-4">{policy.eyebrow}</p>
          <h1 className="mt-2 font-display text-[32px] font-semibold tracking-[-0.04em] text-ink-950 md:text-[38px]">
            {policy.title}
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-500">{policy.summary}</p>
          <p className="mt-4 text-[11px] text-ink-400">Last updated {policy.updated}</p>
        </div>
      </div>

      <article className="container-page max-w-3xl pt-8">
        <div className="space-y-7">
          {policy.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-[16px] font-semibold tracking-[-0.015em] text-ink-950">
                {section.heading}
              </h2>
              <div className="mt-2 space-y-2">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-[13px] leading-[1.75] text-ink-600">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-line bg-surface/60 p-4">
          <p className="text-[12px] font-semibold text-ink-900">Still need help?</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">
            Contact the EventIQ team with your order or event reference and we will take it from
            there.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="mailto:support@eventiq.co.zw" className="btn btn-primary btn-sm">
              <Mail className="h-3.5 w-3.5" /> support@eventiq.co.zw
            </a>
            <Link href="/policies/customer-service" className="btn btn-outline btn-sm">
              Customer service
            </Link>
            <Link href="/policies" className="btn btn-ghost btn-sm">
              All policies
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
