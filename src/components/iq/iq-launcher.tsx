"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { formatDayParts, formatMoney } from "@/lib/format";
import { useDismissable } from "../use-dismissable";

interface IqSource {
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  venue: string;
  city: string;
  category: string;
  priceFromCents: number | null;
  isFree: boolean;
}

interface IqMessage {
  role: "user" | "assistant";
  content: string;
  sources?: IqSource[];
}

const SUGGESTIONS = [
  "What's on this weekend in Harare?",
  "Free events this month",
  "Comedy nights in Bulawayo",
];

// Stage 1 is public event discovery only, so IQ stays off the signed-in
// attendee, artist, organiser and operations surfaces for now.
const PRIVATE_PREFIXES = [
  "/admin",
  "/artist",
  "/organizer",
  "/dashboard",
  "/orders",
  "/checkout",
  "/scan",
  "/security",
  "/login",
  "/register",
];

function IqMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 44 44" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="iq-panel-mark" x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0" stopColor="#6026D9" />
          <stop offset="0.55" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <g fill="url(#iq-panel-mark)">
        <rect x="2.5" y="2.5" width="9" height="39" rx="4.5" />
        <rect x="2.5" y="2.5" width="29" height="9" rx="4.5" />
        <rect x="2.5" y="17.5" width="18.5" height="9" rx="4.5" />
        <rect x="2.5" y="32.5" width="29" height="9" rx="4.5" />
        <path d="M27 14 L38.5 22 L27 30 Z" stroke="url(#iq-panel-mark)" strokeWidth="3.4" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function sourceWhen(iso: string) {
  const parts = formatDayParts(iso);
  return `${parts.weekday} ${parts.day} ${parts.month}`;
}

function SourceList({ sources }: { sources: IqSource[] }) {
  if (!sources.length) return null;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink-400">
        From EventIQ listings
      </p>
      {sources.map((source) => (
        <Link
          key={source.slug}
          href={`/events/${source.slug}`}
          className="group flex items-start gap-2.5 rounded-xl border border-line bg-white p-2.5 transition hover:border-brand-300 hover:shadow-sm"
        >
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold text-ink-950 group-hover:text-brand-700">
              {source.title}
            </span>
            <span className="mt-0.5 block truncate text-[10.5px] text-ink-500">
              {sourceWhen(source.startsAt)} · {source.venue}, {source.city}
            </span>
            <span className="mt-1 inline-flex rounded-full bg-surface px-2 py-0.5 text-[9.5px] font-semibold text-ink-700">
              {source.isFree
                ? "Free"
                : source.priceFromCents !== null
                  ? `From ${formatMoney(source.priceFromCents)}`
                  : "See price"}
            </span>
          </span>
          <ArrowUpRight
            className="mt-1 h-3.5 w-3.5 shrink-0 text-ink-300 transition group-hover:text-brand-600"
            aria-hidden="true"
          />
        </Link>
      ))}
    </div>
  );
}

export function IqLauncher({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<IqMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setReady(true);
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Clicking away or navigating closes the panel without stealing focus;
  // Escape and the close button return focus to the launch button.
  useDismissable({
    open,
    onClose: (reason) => close(reason === "escape"),
    containerRef: panelRef,
    triggerRef: buttonRef,
  });

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  const restore = useCallback(async () => {
    if (restored) return;
    setRestored(true);
    try {
      const response = await fetch("/api/iq/chat", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as {
        conversationId: string | null;
        messages: IqMessage[];
      };
      if (data.messages?.length) {
        setMessages(data.messages);
        setConversationId(data.conversationId);
      }
    } catch {
      // A missing history is not an error the visitor needs to see.
    }
  }, [restored]);

  function openPanel() {
    setOpen(true);
    void restore();
  }

  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => buttonRef.current?.focus(), 0);
  }

  function startNewChat() {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setInput("");
    inputRef.current?.focus();
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    setMessages((current) => [...current, { role: "user", content: message }]);

    try {
      const response = await fetch("/api/iq/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, message }),
      });
      const data = (await response.json().catch(() => null)) as
        | { conversationId?: string; reply?: string; sources?: IqSource[]; error?: string }
        | null;

      if (!response.ok || !data?.reply) {
        if (response.status === 409) {
          startNewChat();
          setError("That chat is full, so I started a fresh one.");
          return;
        }
        setError(data?.error || "IQ couldn't answer just now. Please try again.");
        return;
      }

      if (!mounted.current) return;
      if (data.conversationId) setConversationId(data.conversationId);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.reply as string, sources: data.sources || [] },
      ]);
    } catch {
      setError("I couldn't reach EventIQ. Check your connection and try again.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  if (!enabled || !ready) return null;
  if (PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : openPanel())}
        aria-label="Ask IQ, the EventIQ event discovery assistant"
        className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-[linear-gradient(120deg,#6026D9,#7C3AED_55%,#22D3EE)] px-4 py-3 font-display text-[13px] font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:transition-none"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        Ask IQ
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="iq-panel-title"
          className="fixed inset-0 z-[70] flex flex-col bg-white sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[600px] sm:max-h-[calc(100vh-8rem)] sm:w-[400px] sm:rounded-3xl sm:border sm:border-line sm:shadow-2xl sm:ring-1 sm:ring-black/5"
        >
          <header className="flex items-center gap-3 border-b border-white/10 bg-ink-950 px-4 py-3.5 text-white sm:rounded-t-3xl">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <IqMark className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="iq-panel-title" className="font-display text-[15px] font-bold leading-tight">
                IQ <span className="font-medium text-white/50">by EventIQ</span>
              </h2>
              <p className="truncate text-[10.5px] text-white/50">Event discovery · Zimbabwe</p>
            </div>
            {messages.length ? (
              <button
                type="button"
                onClick={startNewChat}
                aria-label="Start a new chat"
                className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-400"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => close()}
              aria-label="Close IQ"
              className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-400"
            >
              <X className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto bg-surface/60 px-4 py-4">
            {messages.length === 0 && !busy ? (
              <div className="flex h-full flex-col justify-center py-6 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-line">
                  <IqMark className="h-9 w-9" />
                </span>
                <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-ink-950">
                  Your intelligent partner
                  <br />
                  for every event.
                </h3>
                <p className="mx-auto mt-2 max-w-[260px] text-[12.5px] leading-relaxed text-ink-500">
                  I search real EventIQ listings by city, date, category or price. Try one of these:
                </p>
                <div className="mt-5 space-y-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void send(suggestion)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5 text-left text-[12.5px] font-medium text-ink-800 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                    >
                      {suggestion}
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-300" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-4" aria-live="polite">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-white"
                        : "max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-white px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-800 shadow-sm"
                    }
                  >
                    <p className="whitespace-pre-line">{message.content}</p>
                    {message.role === "assistant" ? (
                      message.sources?.length ? (
                        <SourceList sources={message.sources} />
                      ) : (
                        <p className="mt-2 text-[9.5px] font-medium uppercase tracking-[0.14em] text-ink-400">
                          IQ guidance · not EventIQ data
                        </p>
                      )
                    ) : null}
                  </div>
                </div>
              ))}

              {busy ? (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3 shadow-sm">
                    <span className="sr-only">IQ is thinking</span>
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 motion-reduce:animate-none"
                        style={{ animationDelay: `${dot * 120}ms` }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900">
                {error}
              </div>
            ) : null}
          </div>

          <form
            className="border-t border-line bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:rounded-b-3xl"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={800}
                placeholder="Ask about events, cities, dates…"
                aria-label="Ask IQ a question"
                className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface/60 px-3.5 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-brand-400 focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                aria-label="Send question"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] leading-relaxed text-ink-400">
              IQ uses EventIQ listings and can make mistakes. Answers are suggestions, not bookings.
            </p>
          </form>
        </div>
      ) : null}
    </>
  );
}
