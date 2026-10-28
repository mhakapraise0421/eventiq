import type { Role } from "./types";

export function homeForRole(role: Role) {
  if (role === "organizer") return "/organizer";
  if (role === "artist") return "/artist";
  if (role === "gate") return "/scan";
  if (role === "admin" || role === "ceo") return "/admin";
  return "/dashboard";
}
