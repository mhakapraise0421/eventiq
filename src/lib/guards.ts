import "server-only";
import { redirect } from "next/navigation";
import { requireRolePage } from "./auth";
import { getOrganizerProfile } from "./admin";
import { getArtistProfile } from "./artists";

export async function requireApprovedOrganizer() {
  const user = await requireRolePage(["organizer", "admin", "ceo"]);
  if (user.role !== "organizer") redirect("/admin");
  const profile = getOrganizerProfile(user.id);
  if (!profile) redirect("/organizer/apply");
  if (profile.status !== "approved") redirect("/organizer");
  return { user, profile };
}

export async function requireArtistPage() {
  const user = await requireRolePage(["artist"], "/login");
  const profile = getArtistProfile(user.id);
  if (!profile) redirect("/artist/apply");
  return { user, profile };
}
