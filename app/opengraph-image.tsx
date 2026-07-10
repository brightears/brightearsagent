import { ImageResponse } from "next/og";

// Site-wide OG card (P6.12): every shared link used to unfurl as a bare URL —
// zero og tags, no image asset. The Next opengraph-image file convention
// renders this JSX to a 1200×630 PNG and wires og:image for every route that
// doesn't override it. Typographic on the ink canvas per docs/DESIGN.md
// (editorial type IS the brand; no external assets to load or 404).

export const alt = "Bright Ears — the AI that finds gigs for performers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#17161f",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            color: "#f5f2ec",
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: -1,
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 999,
              border: "5px solid #00bbe4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#00bbe4",
              fontSize: 20,
              fontWeight: 900,
            }}
          >
            BE
          </div>
          Bright Ears
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 900,
              letterSpacing: -3,
              lineHeight: 1.02,
              color: "#f5f2ec",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Never miss a gig</span>
            <span
              style={{
                backgroundImage: "linear-gradient(90deg, #ff2dae, #ff8a00)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              you never knew existed.
            </span>
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: "rgba(245,242,236,0.62)" }}>
            The AI finds it, drafts it in your voice — you approve.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "rgba(245,242,236,0.5)",
          }}
        >
          <span style={{ letterSpacing: 4, textTransform: "uppercase", color: "#00bbe4" }}>
            For performers of every kind
          </span>
          <span>brightears.io</span>
        </div>
      </div>
    ),
    size,
  );
}
