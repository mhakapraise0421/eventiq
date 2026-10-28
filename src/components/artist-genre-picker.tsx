"use client";

import { ARTIST_GENRES, MAX_ARTIST_GENRES } from "@/lib/artist-options";

export function ArtistGenrePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(genre: string) {
    if (value.includes(genre)) {
      onChange(value.filter((item) => item !== genre));
      return;
    }
    if (value.length < MAX_ARTIST_GENRES) onChange([...value, genre]);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {ARTIST_GENRES.map((genre) => {
          const active = value.includes(genre);
          return (
            <button
              key={genre}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(genre)}
              className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition ${
                active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-line bg-white text-ink-500 hover:border-ink-300 hover:text-ink-900"
              }`}
            >
              {genre}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10.5px] text-ink-400">
        {value.length} of {MAX_ARTIST_GENRES} selected
      </p>
    </div>
  );
}
