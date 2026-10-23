"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";

export function FavoriteButton({
  eventId,
  initialFavorited,
  isAuthenticated,
  variant = "icon",
}: {
  eventId: string;
  initialFavorited: boolean;
  isAuthenticated: boolean;
  variant?: "icon" | "pill";
}) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);

  async function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    if (!isAuthenticated) {
      router.push("/login?next=/events");
      return;
    }

    const next = !favorited;
    setFavorited(next);
    setBusy(true);
    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = (await response.json()) as { favorited?: boolean; error?: string };
      if (!response.ok) {
        setFavorited(!next);
      } else {
        setFavorited(Boolean(data.favorited));
        router.refresh();
      }
    } catch {
      setFavorited(!next);
    } finally {
      setBusy(false);
    }
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={favorited}
        className={`btn btn-sm ${favorited ? "btn-primary" : "btn-outline"}`}
        disabled={busy}
      >
        <Heart className={`h-3.5 w-3.5 ${favorited ? "fill-current" : ""}`} />
        {favorited ? "Saved" : "Save event"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from saved events" : "Save this event"}
      className={`flex h-7 w-7 items-center justify-center rounded-full bg-white/95 shadow-sm backdrop-blur transition hover:scale-105 ${
        busy ? "opacity-70" : ""
      }`}
    >
      <Heart
        className={`h-3.5 w-3.5 transition ${
          favorited ? "fill-brand-600 text-brand-600" : "text-ink-500"
        }`}
      />
    </button>
  );
}
