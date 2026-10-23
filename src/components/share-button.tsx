"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export function ShareButton({
  title,
  url,
  label = "Share",
  className = "btn btn-outline btn-sm",
}: {
  title: string;
  url: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const absolute = url.startsWith("http")
      ? url
      : `${window.location.origin}${url}`;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url: absolute });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={share} className={className}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      {copied ? "Link copied" : label}
    </button>
  );
}
