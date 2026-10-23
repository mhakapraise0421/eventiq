import "server-only";
import { redirect } from "next/navigation";
import { requireRolePage } from "./auth";
import { getOrganizerProfile } from "./admin";

export async function requireApprovedOrganizer() {
  const user = await requireRolePage(["organizer", "admin", "ceo"]);
  if (user.role !== "organizer") redirect("/admin");
  const profile = getOrganizerProfile(user.id);
  if (!profile) redirect("/organizer/apply");
  if (profile.status !== "approved") redirect("/organizer");
  return { user, profile };
}
