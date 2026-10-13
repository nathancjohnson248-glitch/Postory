import type { Metadata } from "next";
import { PageHero, Prose } from "@/components/marketing/page-hero";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy", description: "How Postory collects, uses and protects your information.", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy policy" body="Last updated October 11, 2026." />
      <Prose>
        <p>This policy explains what Postory (&ldquo;we&rdquo;) collects when you use {site.domain}, why, and the choices you have. We keep it short and plain on purpose.</p>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account details:</strong> your name, email address and sign-in method (email and password, or Google).</li>
          <li><strong>Business information you give us:</strong> your business profile, voice preferences, business memory, stories and posts, and media you upload or generate.</li>
          <li><strong>Connected accounts:</strong> the display name and identifiers of social accounts you connect. OAuth access tokens are held by Zernio, our social connection provider, not stored in Postory&apos;s database. A Bluesky app password, if you connect Bluesky, is stored encrypted and used only to post and read replies.</li>
          <li><strong>Billing status:</strong> your plan, trial and subscription status from our payment provider. We never receive or store your full card details.</li>
          <li><strong>Usage and technical data:</strong> feature usage needed to apply plan limits, and server logs used to keep the service secure and working.</li>
        </ul>
        <h2>How we use it</h2>
        <ul>
          <li>To run Postory: draft, store, schedule and publish the posts you approve.</li>
          <li>To apply your plan&apos;s limits and keep billing accurate.</li>
          <li>To send transactional emails, such as account and publishing notices.</li>
          <li>To secure the service and fix problems.</li>
        </ul>
        <p>We don&apos;t sell your personal information, and we don&apos;t use your content to advertise to you.</p>
        <h2>Service providers</h2>
        <p>We rely on a small number of providers to operate Postory, each only for its purpose: Supabase (database, authentication and file storage), Zernio (connecting the social accounts you choose, holding their access tokens, and carrying the posts you approve, their engagement and comments to and from each network), an AI model provider (running the language model that writes posts), Replicate (making images), HandyPay (subscriptions and payments), Privy (Google sign-in), Zoho Mail (email) and Railway (hosting). Bluesky is reached directly through its own API. When you use AI features, the relevant story text and business information are sent to the AI provider to produce your drafts; image requests contain a description of the image, not your account details.</p>
        <h2>Retention and deletion</h2>
        <p>Your content stays in Postory until you delete it or delete your account. Ending a trial or subscription, or disconnecting a social account, doesn&apos;t delete your content. Deleting your account permanently removes your profile, stories, posts, business memory, media and connections from Postory. Posts already published to social networks stay on those networks; remove them there if you wish.</p>
        <h2>Security</h2>
        <p>Data is encrypted in transit. Access to your records is restricted to your account at the database level, and secrets used to talk to our providers are kept on our servers only.</p>
        <h2>Your choices</h2>
        <p>You can view and edit your information in Settings, export what you&apos;ve written by copying it from your library, and delete your account at any time. To ask about your data, email <a href={`mailto:${site.founder.email}`}>{site.founder.email}</a>.</p>
        <h2>Changes</h2>
        <p>If we make material changes we&apos;ll update this page and, where appropriate, let you know by email.</p>
      </Prose>
    </>
  );
}
