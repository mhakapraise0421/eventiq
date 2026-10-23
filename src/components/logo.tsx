import Link from "next/link";

export function Logo({
  variant = "dark",
  size = "md",
}: {
  variant?: "dark" | "light";
  size?: "sm" | "md";
}) {
  const textColor = variant === "light" ? "text-white" : "text-ink-950";
  const dim = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const text = size === "sm" ? "text-[17px]" : "text-[19px]";

  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="EventIQ home">
      <span
        className={`${dim} relative inline-flex items-center justify-center overflow-hidden rounded-[11px] bg-gradient-to-br from-brand-400 via-brand-600 to-brand-800 shadow-[0_2px_10px_rgba(2,14,153,0.45)]`}
      >
        <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none">
          <path
            d="M5.5 7.2h9.2c1.7 0 3 1.35 3 3v3.6c0 1.65-1.3 3-3 3H5.5"
            stroke="white"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <path
            d="M9.2 11.6h6.6"
            stroke="#22D3EE"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <circle cx="17.4" cy="11.6" r="1.25" fill="#67E8F9" />
        </svg>
      </span>
      <span className={`font-display ${text} font-semibold tracking-[-0.04em] ${textColor}`}>
        Event
        <span className={variant === "light" ? "text-brand-300" : "text-brand-600"}>
          IQ
        </span>
      </span>
    </Link>
  );
}
