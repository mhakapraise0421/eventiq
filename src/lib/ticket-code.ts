import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveSecret } from "./secrets";

const CODE_PATTERN = /^EVQ-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

function secret() {
  return resolveSecret("TICKET_SECRET", "ticket");
}

export function signTicketCode(code: string) {
  const signature = createHmac("sha256", secret())
    .update(code)
    .digest("base64url")
    .slice(0, 16);
  return `EVQ1|${code}|${signature}`;
}

export function parseScannedPayload(
  input: string,
  options: { requireSignature?: boolean } = {},
): string | null {
  const value = input.trim();
  if (CODE_PATTERN.test(value)) return options.requireSignature ? null : value;
  if (!value.startsWith("EVQ1|")) return null;
  const [, code, signature] = value.split("|");
  if (!code || !signature || !CODE_PATTERN.test(code)) return null;
  const expected = createHmac("sha256", secret())
    .update(code)
    .digest("base64url")
    .slice(0, 16);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return code;
}
