import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { NavigationProgress } from "@/components/motion/navigation-progress";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://postory.lol";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Postory - AI social media for founders who ship",
    template: "%s · Postory",
  },
  description:
    "Tell Postory what happened in your business. Its AI finds the story, writes platform-native posts for every network, and prepares each one for your approval.",
  applicationName: "Postory",
  openGraph: {
    type: "website",
    siteName: "Postory",
    url: appUrl,
    title: "Postory - AI social media for founders who ship",
    description: "Turn what happened into what gets posted. One story in, platform-native posts out — approved by you, published everywhere.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Postory - AI social media for founders who ship",
    description: "Turn what happened into what gets posted.",
  },
};

export const viewport: Viewport = {
  themeColor: "#fafaf8",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}>
      <body className="min-h-full bg-paper text-ink">
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "!rounded-2xl !border-0 !shadow-lift !ring-1 !ring-line !font-sans",
          }}
        />
      </body>
    </html>
  );
}
