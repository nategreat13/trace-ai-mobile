import { ImageResponse } from "next/og";

export const alt = "Trace Points: you're sitting on a free flight";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The link preview card for shares and ads. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          color: "white",
          background: "linear-gradient(135deg, #FF655B 0%, #FD297B 55%, #7C3AED 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 2 }}>TRACE POINTS</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>You&apos;re sitting on a free flight.</div>
          <div style={{ fontSize: 36, marginTop: 28, opacity: 0.92 }}>See what your points can book from your airport. 60 seconds, no logins.</div>
        </div>
      </div>
    ),
    size,
  );
}
