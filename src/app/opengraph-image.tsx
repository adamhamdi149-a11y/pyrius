import { ImageResponse } from "next/og";

// The preview card shown when a Pyrius link is shared (and used by search engines).
export const alt = "Pyrius — AI travel concierge. Describe your trip; Pyrius finds real flights.";
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
          position: "relative",
          background: "#090A0D",
          color: "#F4F4F6",
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Glow and orb on the right */}
        <div style={{ position: "absolute", right: -160, top: -120, width: 900, height: 900, borderRadius: 9999, background: "radial-gradient(circle, rgba(255,118,40,0.28) 0%, rgba(255,118,40,0) 62%)", display: "flex" }} />
        {/* Ring first, so the orb sits in front of it */}
        <div style={{ position: "absolute", right: 30, top: 285, width: 500, height: 70, borderRadius: 9999, border: "3px solid rgba(255,170,110,0.45)", transform: "rotate(-14deg)", display: "flex" }} />
        <div
          style={{
            position: "absolute",
            right: 110,
            top: 145,
            width: 340,
            height: 340,
            borderRadius: 9999,
            background: "radial-gradient(circle at 36% 30%, #FFF1E2 0%, #FFB27A 16%, #FF7628 48%, #B33C0B 78%, #3A0F02 100%)",
            boxShadow: "0 0 120px 30px rgba(255,118,40,0.45)",
            display: "flex",
          }}
        />

        {/* Copy on the left */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px", width: 760 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9999, background: "radial-gradient(circle at 36% 30%, #FFEFDF, #FF7628 55%, #8A2A06)", display: "flex" }} />
            Pyrius
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 44, fontSize: 84, fontWeight: 700, lineHeight: 1, letterSpacing: -4 }}>
            <span>Flight search,</span>
            <span style={{ color: "#FF8A45" }}>reimagined.</span>
          </div>
          <div style={{ marginTop: 36, fontSize: 30, lineHeight: 1.35, color: "#A8A9B4", display: "flex" }}>Describe your trip. Pyrius finds real flights and sends you to book.</div>
          <div style={{ marginTop: 40, fontSize: 24, color: "#6E7080", display: "flex" }}>pyrius.app · AI travel concierge</div>
        </div>
      </div>
    ),
    size,
  );
}
