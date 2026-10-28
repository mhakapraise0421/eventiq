import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CalendarDays, Mail, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listUserInterests } from "@/lib/attendee";
import { formatDate, ROLE_LABEL } from "@/lib/format";
import { ConsoleHeader } from "@/components/console-header";
import { ProfileForm } from "@/components/profile-form";
import { InterestsPicker } from "@/components/interests-picker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile settings" };

const tabs = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/tickets", label: "My tickets" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/saved", label: "Saved" },
  { href: "/dashboard/parking", label: "Parking" },
  { href: "/dashboard/profile", label: "Profile" },
];

export default async function ProfilePage() {
  const user = await requireUser();
  const interests = listUserInterests(user.id);

  return (
    <div className="min-h-[70vh] bg-surface/40 pb-16">
      <ConsoleHeader
        eyebrow="Account settings"
        title="Profile & preferences"
        description="Update your details, choose notification channels and manage your password."
        tabs={tabs}
      />

      <div className="container-page pt-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-950 font-display text-[15px] font-semibold text-white">
              {user.name
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink-950">
                {user.name}
                <BadgeCheck className="h-4 w-4 text-brand-600" />
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-400">
                <Mail className="h-3 w-3" /> {user.email}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge bg-brand-50 text-brand-700">{ROLE_LABEL[user.role]}</span>
            <span className="flex items-center gap-1 text-[10.5px] text-ink-400">
              <CalendarDays className="h-3 w-3" /> Member since {formatDate(user.created_at)}
            </span>
          </div>
        </div>

        <ProfileForm
          user={{
            name: user.name,
            email: user.email,
            phone: user.phone,
            city: user.city,
            notify_email: user.notify_email,
            notify_sms: user.notify_sms,
            notify_whatsapp: user.notify_whatsapp,
          }}
        />

        <div className="mt-5">
          <InterestsPicker initial={interests} />
        </div>

        <Link
          href="/security"
          className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 transition hover:border-ink-300"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-[13.5px] font-semibold text-ink-950">
                Security &amp; sessions
              </span>
              <span className="block text-[11.5px] text-ink-400">
                Two-factor authentication, recovery codes and signed-in devices.
              </span>
            </span>
          </span>
          <span className="text-[12px] font-semibold text-brand-700">Manage</span>
        </Link>

        <p className="mt-4 flex items-center gap-1.5 text-[10.5px] text-ink-400">
          <ShieldCheck className="h-3 w-3" /> Need your data removed? Contact support and we
          will handle the request under our privacy policy.
        </p>
      </div>
    </div>
  );
}
