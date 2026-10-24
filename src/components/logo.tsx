import Link from "next/link";

function Mark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 44 44" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="eiq-mark" x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0" stopColor="#6026D9" />
          <stop offset="0.55" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <g fill="url(#eiq-mark)">
        <rect x="2.5" y="2.5" width="9" height="39" rx="4.5" />
        <rect x="2.5" y="2.5" width="29" height="9" rx="4.5" />
        <rect x="2.5" y="17.5" width="18.5" height="9" rx="4.5" />
        <rect x="2.5" y="32.5" width="29" height="9" rx="4.5" />
        <path
          d="M27 14 L38.5 22 L27 30 Z"
          stroke="url(#eiq-mark)"
          strokeWidth="3.4"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export function Logo({
  variant = "dark",
  size = "md",
  tagline = false,
}: {
  variant?: "dark" | "light";
  size?: "sm" | "md";
  tagline?: boolean;
}) {
  const mark = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const text = size === "sm" ? "text-[17px]" : "text-[19px]";
  const wordColor = variant === "light" ? "text-white" : "text-ink-950";
  const iqColor = variant === "light" ? "text-aqua-400" : "text-aqua-500";
  const tagColor = variant === "light" ? "text-white/40" : "text-ink-400";
  const dotColor = variant === "light" ? "text-aqua-400" : "text-aqua-500";

  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="EventIQ home">
      <Mark className={`${mark} shrink-0`} />
      <span className="flex flex-col">
        <span
          className={`font-display ${text} font-bold leading-none tracking-[-0.035em] ${wordColor}`}
        >
          Event
          <span className={iqColor}>IQ</span>
        </span>
        {tagline ? (
          <span
            className={`mt-1.5 hidden text-[8px] font-semibold uppercase tracking-[0.22em] sm:block ${tagColor}`}
          >
            Tickets <span className={dotColor}>·</span> Events{" "}
            <span className={dotColor}>·</span> Experiences
          </span>
        ) : null}
      </span>
    </Link>
  );
}
