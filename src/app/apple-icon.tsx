import { ImageResponse } from "next/og";

// Home-screen icon and the logo search engines can show: the orb on Pyrius black.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0C0D11" }}>
        <div
          style={{
            width: 104,
            height: 104,
            borderRadius: 9999,
            background: "radial-gradient(circle at 36% 30%, #FFEFDF 0%, #FFAE70 20%, #FF7628 58%, #8A2A06 100%)",
            boxShadow: "0 0 36px 6px rgba(255,118,40,0.5)",
            display: "flex",
          }}
        />
      </div>
    ),
    size,
  );
}
