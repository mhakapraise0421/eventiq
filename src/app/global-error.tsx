"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FFFFFF",
          color: "#111114",
          fontFamily:
            "Montserrat, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: 520,
            margin: 24,
            padding: "40px 32px",
            border: "1px solid #E7E7EE",
            borderRadius: 24,
            textAlign: "center",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              margin: "0 auto 20px",
              borderRadius: 12,
              background: "linear-gradient(120deg, #6026D9 55%, #22D3EE)",
            }}
          />
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#6026D9",
            }}
          >
            Something went wrong
          </p>
          <h1 style={{ margin: "12px 0 0", fontSize: 26, lineHeight: 1.2 }}>
            EventIQ needs to reload.
          </h1>
          <p style={{ margin: "14px 0 0", fontSize: 14, lineHeight: 1.6, color: "#5A5A6B" }}>
            Nothing has been charged and your tickets are safe. Reload the page to continue.
          </p>
          {error.digest ? (
            <p style={{ margin: "12px 0 0", fontSize: 11, color: "#8A8A99" }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 26,
              padding: "12px 22px",
              border: 0,
              borderRadius: 999,
              background: "#6026D9",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload EventIQ
          </button>
        </main>
      </body>
    </html>
  );
}
