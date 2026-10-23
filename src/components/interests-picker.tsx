"use client";

import { useState } from "react";
import { Check, Info, Sparkles } from "lucide-react";
import { CATEGORIES } from "@/lib/format";

const MAX_INTERESTS = 6;

export function InterestsPicker({ initial }: { initial: string[] }) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");

  function toggle(category: string) {
    setError("");
    setState("idle");
    setSelected((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : current.length >= MAX_INTERESTS
          ? current
          : [...current, category],
    );
  }

  async function save() {
    setState("saving");
    setError("");
    try {
      const response = await fetch("/api/profile/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: selected }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Could not save your interests.");
      } else {
        setState("saved");
        setTimeout(() => setState("idle"), 3500);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setState((current) => (current === "saved" ? "saved" : "idle"));
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 font-display text-[17px] font-semibold tracking-[-0.02em]">
            <Sparkles className="h-4 w-4 text-brand-600" /> What are you into?
          </h2>
          <p className="mt-1 text-[11.5px] text-ink-400">
            Pick up to {MAX_INTERESTS} categories — we use them to suggest events on your
            dashboard. Choose {MAX_INTERESTS} or fewer.
          </p>
        </div>
        {state === "saved" ? (
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-600">
            <Check className="h-4 w-4" /> Saved
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {CATEGORIES.map((category) => {
          const active = selected.includes(category);
          return (
            <button
              key={category}
              type="button"
              onClick={() => toggle(category)}
              aria-pressed={active}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                active
                  ? "bg-brand-600 text-white shadow-sm"
                  : "border border-line bg-white text-ink-500 hover:border-brand-300 hover:text-brand-700"
              }`}
            >
              {active ? <Check className="mr-1 inline h-3 w-3" /> : null}
              {category}
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          className="btn btn-primary btn-sm"
          disabled={state === "saving"}
        >
          {state === "saving" ? "Saving…" : "Save interests"}
        </button>
        <p className="flex items-center gap-1.5 text-[10.5px] text-ink-400">
          <Info className="h-3 w-3" /> {selected.length}/{MAX_INTERESTS} selected
        </p>
      </div>
    </div>
  );
}
