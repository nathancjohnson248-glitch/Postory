import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Postory - AI social media for founders who ship",
    short_name: "Postory",
    description: "Turn what happened into what gets posted.",
    start_url: "/app",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1670FF",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
