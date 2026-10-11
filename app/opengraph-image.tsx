import { ImageResponse } from "next/og";

export const alt = "Postory — Your business doesn't stop. Neither should your social.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#fafaf8", color: "#0c0c0e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="44" height="44" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="9" fill="#2F5BFF" />
            <g stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" transform="translate(0.5 0.5)">
              <path d="M8 23V15C8 10.6 11.6 7 16 7H23" />
              <path d="M19.5 3.5L23 7L19.5 10.5" />
              <path d="M8 23C8 20 10.5 17.5 13.5 17.5H23" />
              <path d="M19.5 14L23 17.5L19.5 21" />
            </g>
            <circle cx="8.5" cy="25" r="2.4" fill="#fff" />
          </svg>
          <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1.5 }}>postory</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 84, lineHeight: 1, letterSpacing: -3, fontWeight: 600 }}>
          <span>Your business doesn&apos;t stop.</span>
          <span style={{ color: "#2F5BFF" }}>Neither should your social.</span>
        </div>
        <span style={{ fontSize: 28, color: "#66666e" }}>postory.lol</span>
      </div>
    ),
    size,
  );
}
