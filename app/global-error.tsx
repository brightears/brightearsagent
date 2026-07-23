"use client";

// Last-resort boundary: this replaces the ROOT layout when the layout itself
// (or app/error.tsx) crashes, so it must render its own <html>/<body> and
// cannot rely on the app's CSS pipeline — Tailwind classes, next/font and the
// component library may all be part of what just failed. Inline styles only,
// matching the ink/cream palette by hand. Keep it minimal: if we're here,
// less is safer.

const ink = "#17161f";
const cream = "#e8e4dc";
const creamBright = "#f5f2ec";
const cyan = "#00bbe4";

export default function GlobalError({
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
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: ink,
          color: cream,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        <p
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: cyan,
            margin: 0,
          }}
        >
          Bright Ears
        </p>
        <h1
          style={{
            margin: "16px 0 0",
            maxWidth: 560,
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            color: creamBright,
            lineHeight: 1.1,
          }}
        >
          This page hit a wrong note.
        </h1>
        <p
          style={{
            margin: "16px 0 0",
            maxWidth: 420,
            fontSize: 14,
            lineHeight: 1.6,
            color: "rgba(232, 228, 220, 0.6)",
          }}
        >
          Something went sideways on our end — your account is untouched. Try again, or head back
          to the front page.
        </p>
        <div
          style={{
            marginTop: 32,
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={reset}
            style={{
              borderRadius: 9999,
              border: "none",
              background: cyan,
              color: ink,
              fontWeight: 700,
              fontSize: 14,
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <a
            href="/"
            style={{
              borderRadius: 9999,
              border: `1.5px solid rgba(232, 228, 220, 0.4)`,
              color: cream,
              fontWeight: 600,
              fontSize: 14,
              padding: "9px 20px",
              textDecoration: "none",
            }}
          >
            Front page
          </a>
        </div>
      </body>
    </html>
  );
}
