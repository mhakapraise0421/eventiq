import {
  statusTone,
  ARTIST_VERIFICATION_LABEL,
  EVENT_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  ROLE_LABEL,
} from "@/lib/format";

export function StatusBadge({
  status,
  kind = "event",
  label,
}: {
  status: string;
  kind?: "event" | "order" | "organizer" | "scan" | "user" | "device" | "price" | "verification";
  label?: string;
}) {
  const text =
    label ||
    (kind === "order"
      ? ORDER_STATUS_LABEL[status] || status
      : kind === "organizer" || kind === "price"
        ? {
            pending: "Pending review",
            approved: "Approved",
            rejected: "Rejected",
            requires_modification: "Changes required",
          }[status] || status
        : kind === "verification"
          ? ARTIST_VERIFICATION_LABEL[status] || status
          : kind === "user"
            ? ROLE_LABEL[status] || status
            : EVENT_STATUS_LABEL[status] || status);

  return <span className={`badge ${statusTone(status)}`}>{text}</span>;
}
