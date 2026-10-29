import "server-only";

export type IqSurface = "public" | "attendee" | "artist" | "organizer" | "operations";

export interface IqSource {
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

export interface IqChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: IqSource[];
}

export interface IqAnswer {
  text: string;
  provider: string;
  model: string;
  /** True only when the reply is grounded in the events retrieved for it. */
  grounded: boolean;
}
