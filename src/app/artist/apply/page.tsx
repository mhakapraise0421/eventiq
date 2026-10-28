import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BadgeCheck, ShieldQuestion } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getArtistProfile } from "@/lib/artists";
import { ConsoleHeader } from "@/components/console-header";
import { ArtistApplyForm } from "@/components/artist-apply-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Join EventIQ as an artist" };

export default async function ArtistApplyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fartist%2Fapply");
  if (user.role === "artist" && getArtistProfile(user.id)) redirect("/artist/profile");

  const blocked = user.role !== "attendee" && user.role !== "artist";

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Artist onboarding"
        title="Join EventIQ as an artist"
        description="Create a professional profile, get discovered by organizers and apply for a verified artist badge."
        actions={
          <Link href="/artists" className="btn btn-outline btn-sm">
            <ArrowLeft className="h-3.5 w-3.5" /> Artist directory
          </Link>
        }
      />

      <div className="container-page max-w-4xl pt-6">
        {blocked ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-900">
              <ShieldQuestion className="h-4 w-4" /> This account cannot start an artist profile
            </p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-amber-800/80">
              Artist profiles use a dedicated <strong>{user.role}</strong> login. EventIQ currently
              supports one role per account, so a separate artist account is needed. Sign out and
              create a new account, or contact support if you need to split an existing account.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/register" className="btn btn-primary btn-sm">
                Create a new account
              </Link>
              <Link href="/dashboard" className="btn btn-outline btn-sm">
                Back to my account
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-5 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-900">
                <BadgeCheck className="h-4 w-4" /> Before you start
              </p>
              <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-brand-900/70">
                <li>Use the name organizers know you by, not your legal name.</li>
                <li>Your profile starts as a private draft until you publish it.</li>
                <li>Verification needs an identity document and is reviewed by a person.</li>
              </ul>
            </div>
            <ArtistApplyForm />
          </>
        )}
      </div>
    </div>
  );
}
