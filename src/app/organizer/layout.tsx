import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { mfaSatisfied } from "@/lib/mfa";
import { getOrganizerProfile } from "@/lib/admin";
import { iqEnabled } from "@/lib/iq/config";
import { workspaceSuggestions } from "@/lib/iq/workspace";
import { IqWorkspace } from "@/components/iq/iq-workspace";

export default async function OrganizerLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const ready = !!user && user.role === "organizer" && iqEnabled() && mfaSatisfied(user);
  const profile = ready && user ? getOrganizerProfile(user.id) : undefined;

  return (
    <>
      {children}
      {ready && user ? (
        <IqWorkspace
          surface="organizer"
          name={profile?.business_name || user.name}
          suggestions={workspaceSuggestions("organizer")}
        />
      ) : null}
    </>
  );
}
