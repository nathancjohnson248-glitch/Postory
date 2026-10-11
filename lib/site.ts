/** Public site configuration shared by marketing pages and emails. */
export const site = {
  name: "Postory",
  domain: "postory.lol",
  url: (process.env.NEXT_PUBLIC_APP_URL || "https://postory.lol").replace(/\/+$/, ""),
  founder: {
    name: "Nathan",
    xUrl: process.env.NEXT_PUBLIC_FOUNDER_X_URL || "https://x.com/nathanjhsn",
    xHandle: "@nathanjhsn",
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "nathanjhsn@icloud.com",
  },
} as const;
