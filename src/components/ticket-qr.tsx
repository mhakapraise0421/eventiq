"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";

export function TicketQR({
  value,
  size = 168,
}: {
  value: string;
  size?: number;
}) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#08080d", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-surface text-ink-300"
        style={{ width: size, height: size }}
      >
        <QrCode className="h-7 w-7" />
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={dataUrl}
      alt="Ticket QR code"
      width={size}
      height={size}
      className="rounded-xl bg-white"
    />
  );
}
