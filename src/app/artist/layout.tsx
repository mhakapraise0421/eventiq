import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { mfaSatisfied } from "@/lib/mfa";
import { getArtistProfile } from "@/lib/artists";
import { iqEnabled } from "@/lib/iq/config";
import { workspaceSuggestions } from "@/lib/iq/workspace";
import { IqWorkspace } from "@/components/iq/iq-workspace";

export default async function ArtistLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const ready = !!user && user.role === "artist" && iqEnabled() && mfaSatisfied(user);
  const profile = ready && user ? getArtistProfile(user.id) : undefined;

  return (
    <>
      {children}
      {ready && user ? (
        <IqWorkspace
          surface="artist"
          name={profile?.stage_name || user.name}
          suggestions={workspaceSuggestions("artist")}
        />
      ) : null}
    </>
  );
}
