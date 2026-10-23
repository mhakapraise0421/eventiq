"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print tickets" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-outline btn-sm no-print">
      <Printer className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
