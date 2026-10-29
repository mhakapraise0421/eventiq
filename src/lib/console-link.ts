import { Mic, ScanLine, ShieldCheck, Sparkles, Ticket, type LucideIcon } from "lucide-react";
import type { Role } from "./types";

export function consoleLink(role: Role): { href: string; label: string; icon: LucideIcon } {
  if (role === "organizer") return { href: "/organizer", label: "Organizer dashboard", icon: Sparkles };
  if (role === "artist") return { href: "/artist", label: "Artist dashboard", icon: Mic };
  if (role === "gate") return { href: "/scan", label: "Gate scanner", icon: ScanLine };
  if (role === "admin" || role === "ceo") return { href: "/admin", label: "Admin console", icon: ShieldCheck };
  return { href: "/dashboard", label: "My tickets", icon: Ticket };
}
