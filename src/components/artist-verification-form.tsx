"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Send, Trash2, Upload } from "lucide-react";

export interface ArtistDocumentView {
  id: string;
  label: string;
  fileName: string;
  size: number;
  uploadedAt: string;
  submitted: boolean;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ArtistVerificationForm({
  status,
  documents,
  canSubmit,
}: {
  status: "not_submitted" | "pending" | "requires_info" | "verified" | "rejected";
  documents: ArtistDocumentView[];
  canSubmit: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const available = documents.filter((doc) => !doc.submitted);
  const resubmission = status === "requires_info" || status === "rejected";

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a PDF, JPEG or PNG file to upload.");
      return;
    }
    setBusy("upload");
    setError("");
    setDone("");
    const data = new FormData();
    data.append("file", file);
    data.append("label", label);
    try {
      const response = await fetch("/api/artist/documents", { method: "POST", body: data });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error || "Could not upload that document.");
        return;
      }
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
      setDone("Document uploaded. Select it below before you submit.");
      router.refresh();
    } catch {
      setError("Network error while uploading. Please try again.");
    } finally {
      setBusy("");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this document? Uploaded files cannot be restored.")) return;
    setBusy(`remove:${id}`);
    setError("");
    setDone("");
    try {
      const response = await fetch(`/api/artist/documents/${id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error || "Could not remove that document.");
        return;
      }
      setSelected(selected.filter((item) => item !== id));
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy("");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected.length) {
      setError("Select at least one document to submit.");
      return;
    }
    setBusy("submit");
    setError("");
    setDone("");
    try {
      const response = await fetch("/api/artist/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, documentIds: selected }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error || "Could not submit your verification request.");
        return;
      }
      setNote("");
      setSelected([]);
      setDone("Verification request submitted. An EventIQ reviewer will respond.");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
          <Upload className="h-4 w-4 text-brand-600" /> Add a document
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
          Upload a national ID, passport or artist registration document. PDF, JPEG or PNG, up to
          5 MB. Only you and EventIQ reviewers can open it.
        </p>
        <form onSubmit={upload} className="mt-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-[1fr_1.2fr]">
            <input
              className="input text-[12px]"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Document label (e.g. National ID)"
              maxLength={60}
            />
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="input py-1.5 text-[11.5px] file:mr-2 file:rounded-md file:border-0 file:bg-brand-50 file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-brand-700"
            />
          </div>
          <button type="submit" className="btn btn-outline btn-sm" disabled={busy === "upload"}>
            <Upload className="h-3.5 w-3.5" />
            {busy === "upload" ? "Uploading…" : "Upload document"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
          <FileText className="h-4 w-4 text-brand-600" /> Your documents
        </h2>
        {documents.length ? (
          <ul className="mt-3 space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2"
              >
                <span className="text-[12px] font-semibold text-ink-800">{doc.label}</span>
                <span className="text-[10.5px] text-ink-400">
                  {doc.fileName} · {formatSize(doc.size)}
                </span>
                {doc.submitted ? (
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-400">
                    Submitted with a previous request
                  </span>
                ) : (
                  <button
                    type="button"
                    className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold text-rose-600"
                    onClick={() => remove(doc.id)}
                    disabled={!!busy}
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11.5px] text-ink-400">No documents uploaded yet.</p>
        )}
      </section>

      {canSubmit ? (
        <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-5">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[-0.02em]">
            <Send className="h-4 w-4 text-brand-600" /> Submit for review
          </h2>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
            {resubmission
              ? "Upload fresh copies of the documents requested by the reviewer, then select them below. Your earlier submission stays on record."
              : "Choose the documents that prove your identity or artist registration. Verification is reviewed by a person; it is never automatic."}
          </p>

          <div className="mt-3 space-y-1.5">
            {available.length ? (
              available.map((doc) => (
                <label key={doc.id} className="flex items-center gap-2 text-[12px] text-ink-700">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-[#6026D9]"
                    checked={selected.includes(doc.id)}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...selected, doc.id]
                          : selected.filter((item) => item !== doc.id),
                      )
                    }
                  />
                  {doc.label}
                  <span className="text-[10.5px] text-ink-400">({formatSize(doc.size)})</span>
                </label>
              ))
            ) : (
              <p className="text-[11px] text-ink-400">
                Upload a new document above to include it in this request.
              </p>
            )}
          </div>

          <div className="mt-3">
            <label className="label" htmlFor="verificationNote">
              Note for the reviewer (optional)
            </label>
            <textarea
              id="verificationNote"
              className="input min-h-[80px] resize-y"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything the reviewer should know…"
              maxLength={500}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-sm mt-3"
            disabled={!!busy || !available.length}
          >
            <Check className="h-3.5 w-3.5" />
            {busy === "submit" ? "Submitting…" : "Submit verification request"}
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-700">
          {done}
        </p>
      ) : null}
    </div>
  );
}
