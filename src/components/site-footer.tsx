import Link from "next/link";
import { Mail, MapPin, ShieldCheck } from "lucide-react";
import { Logo } from "./logo";

const policyLinks = [
  { href: "/policies/terms", label: "Terms & Conditions" },
  { href: "/policies/privacy", label: "Privacy Policy" },
  { href: "/policies/refunds", label: "Refunds & Cancellations" },
  { href: "/policies/customer-service", label: "Customer Service" },
  { href: "/policies/kyc", label: "KYC Policy" },
  { href: "/policies/disputes", label: "Dispute Resolution" },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-ink-950 text-white">
      <div className="container-page py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo variant="light" />
            <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-white/55">
              Zimbabwe-first event discovery, ticketing and gate operations. Built for
              organizers who care about every ticket and every guest.
            </p>
            <div className="mt-5 space-y-2 text-[13px] text-white/55">
              <p className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-white/40" /> Harare, Zimbabwe
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-white/40" /> support@eventiq.co.zw
              </p>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">
              Discover
            </p>
            <ul className="mt-4 space-y-2.5 text-[13.5px] text-white/65">
              <li><Link href="/events" className="hover:text-white">All events</Link></li>
              <li><Link href="/events?category=Concerts" className="hover:text-white">Concerts</Link></li>
              <li><Link href="/events?category=Festivals" className="hover:text-white">Festivals</Link></li>
              <li><Link href="/events?category=Nightlife" className="hover:text-white">Nightlife</Link></li>
              <li><Link href="/events?category=Conferences" className="hover:text-white">Conferences</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">
              Organizers
            </p>
            <ul className="mt-4 space-y-2.5 text-[13.5px] text-white/65">
              <li><Link href="/organizer/apply" className="hover:text-white">Apply to sell</Link></li>
              <li><Link href="/organizer" className="hover:text-white">Organizer dashboard</Link></li>
              <li><Link href="/scan" className="hover:text-white">Gate staff scanner</Link></li>
              <li><Link href="/admin" className="hover:text-white">Administration</Link></li>
              <li><Link href="/policies" className="hover:text-white">Policy centre</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">
              Trust & safety
            </p>
            <ul className="mt-4 space-y-2.5 text-[13.5px] text-white/65">
              {policyLinks.slice(0, 5).map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-[12px] text-white/40 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} EventIQ. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Demo environment · payments are simulated and no card details are collected.
          </p>
        </div>
      </div>
    </footer>
  );
}
