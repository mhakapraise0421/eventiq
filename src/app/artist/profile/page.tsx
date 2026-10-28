import type { Metadata } from "next";
import Link from "next/link";
import { Eye } from "lucide-react";
import { requireArtistPage } from "@/lib/guards";
import { parseGenres, parseMedia, profileGaps } from "@/lib/artists";
import { ConsoleHeader } from "@/components/console-header";
import { artistTabs } from "@/components/artist-tabs";
import { ArtistProfileForm } from "@/components/artist-profile-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artist profile" };

export default async function ArtistProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { profile } = await requireArtistPage();
  const { created } = await searchParams;
  const gaps = profileGaps(profile);

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Artist console"
        title="Public profile"
        description="This is what organizers and the public see once published. Links, bio, rider and availability are public; booking preferences stay private."
        tabs={artistTabs}
        actions={
          profile.visibility === "published" ? (
            <Link href={`/artists/${profile.slug}`} className="btn btn-outline btn-sm">
              <Eye className="h-3.5 w-3.5" /> View public page
            </Link>
          ) : null
        }
      />

      <div className="container-page max-w-4xl pt-6">
        <ArtistProfileForm
          initial={{
            stageName: profile.stage_name,
            category: profile.category,
            genres: parseGenres(profile),
            bio: profile.bio,
            city: profile.city || "",
            region: profile.region || "",
            profileImage: profile.profile_image || "",
            coverImage: profile.cover_image || "",
            website: profile.website || "",
            instagram: profile.instagram || "",
            facebook: profile.facebook || "",
            x: profile.x || "",
            tiktok: profile.tiktok || "",
            youtube: profile.youtube || "",
            media: parseMedia(profile),
            performanceHistory: profile.performance_history || "",
            availabilityNote: profile.availability_note || "",
            bookingPrefs: profile.booking_prefs || "",
            technicalRider: profile.technical_rider || "",
          }}
          visibility={profile.visibility}
          gaps={gaps}
          justCreated={created === "1"}
        />
      </div>
    </div>
  );
}
