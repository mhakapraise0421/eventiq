import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireRolePage } from "@/lib/auth";
import { ConsoleHeader } from "@/components/console-header";
import { VirtualGate } from "@/components/virtual-gate";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Virtual gate simulator" };

export default async function VirtualGatePage() {
  await requireRolePage(["admin", "ceo"]);

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Gate operations · Stage 1"
        title="Virtual gate simulator"
        description="Pair a registered device and exercise the same authenticated scan API a venue bridge will use. Nothing on this page controls physical hardware."
        actions={
          <Link href="/admin/operations" className="btn btn-outline btn-sm">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to operations
          </Link>
        }
      />

      <div className="container-page max-w-5xl space-y-4 pt-6">
        <VirtualGate />

        <div className="flex items-start gap-2 rounded-2xl border border-line bg-white px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <p className="text-[11px] leading-relaxed text-ink-500">
            Stage 1 verifies pairing, heartbeats, signed-payload validation, replay protection and
            gate open/close policy. Stage 2 adds a signed offline manifest for venues with
            intermittent connectivity. Stage 3 adds the on-site bridge that drives a turnstile or
            overhead gate through a dry-contact relay or the controller&apos;s own protocol.
          </p>
        </div>
      </div>
    </div>
  );
}
