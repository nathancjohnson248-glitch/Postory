import { ImageResponse } from "next/og";
import { MARK_BLUE, MARK_EYES, MARK_PATH } from "@/components/brand/logo";

export const alt = "Postory - AI social media for founders who ship";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#fafaf8", color: "#0c0c0e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="52" height="52" viewBox="0 0 64 64">
            <path d={MARK_PATH} fill={MARK_BLUE} />
            {MARK_EYES.map(([cx, cy, rx, ry]) => (
              <ellipse key={cx} cx={cx} cy={cy} rx={rx} ry={ry} fill="#fff" />
            ))}
          </svg>
          <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1.5 }}>Postory</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 84, lineHeight: 1, letterSpacing: -3, fontWeight: 600 }}>
          <span>Turn what happened</span>
          <span style={{ color: "#2F5BFF" }}>into what gets posted.</span>
        </div>
        <span style={{ fontSize: 28, color: "#66666e" }}>AI social media for founders who ship · postory.lol</span>
      </div>
    ),
    size,
  );
}
