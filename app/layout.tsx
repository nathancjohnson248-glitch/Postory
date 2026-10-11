import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
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
    default: "Postory — Your business doesn't stop. Neither should your social.",
    template: "%s · Postory",
  },
  description:
    "Tell Postory what happened in your business. It turns the moment into platform-native posts, waits for your approval, and keeps every network moving.",
  applicationName: "Postory",
  openGraph: {
    type: "website",
    siteName: "Postory",
    url: appUrl,
    title: "Postory — Your business doesn't stop. Neither should your social.",
    description:
      "Social publishing for businesses. One story in, platform-native posts out — reviewed by you, published everywhere.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Postory",
    description: "Your business doesn't stop. Neither should your social.",
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
