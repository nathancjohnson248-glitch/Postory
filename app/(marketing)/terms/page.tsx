import type { Metadata } from "next";
import { PageHero, Prose } from "@/components/marketing/page-hero";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Terms", description: "The terms for using Postory.", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms of service" body="Last updated October 11, 2026." />
      <Prose>
        <p>These terms cover your use of Postory at {site.domain}. By creating an account you agree to them.</p>
        <h2>Your account</h2>
        <p>You&apos;re responsible for activity on your account and for keeping your sign-in details secure. You must be able to form a binding contract to use Postory.</p>
        <h2>Your content</h2>
        <p>You own what you put into Postory and what it drafts for you. You give us permission to store, process and publish it as needed to provide the service — including sending it to the networks you connect when you publish or schedule. You&apos;re responsible for what you approve and publish, and for following each network&apos;s rules.</p>
        <h2>AI-assisted drafts</h2>
        <p>Postory can draft posts with AI. Drafts can contain mistakes, so every post waits for your review. You decide what is published.</p>
        <h2>Connected accounts</h2>
        <p>Connections are made through each network&apos;s own authorization, via our publishing provider. Networks can change or limit their APIs; when that happens a feature may stop working for that network until it can be restored.</p>
        <h2>Plans, trials and billing</h2>
        <p>Paid plans are billed monthly through HandyPay. New customers get a {TRIAL_DAYS}-day trial; if you don&apos;t cancel before it ends, your plan begins and you&apos;re charged. You can cancel any time — access continues until the end of the paid period. Plan changes start a new subscription for the new plan and end the previous one; unused time is not prorated or refunded unless required by law. Plan limits (such as AI generations) reset each billing period.</p>
        <h2>Acceptable use</h2>
        <p>Don&apos;t use Postory to publish unlawful, deceptive or infringing content, to spam, to impersonate others, or to interfere with the service or any network.</p>
        <h2>Availability</h2>
        <p>We work to keep Postory available and accurate but provide it &ldquo;as is&rdquo;. To the extent the law allows, our liability is limited to the amount you paid us in the three months before the claim.</p>
        <h2>Ending your use</h2>
        <p>You can delete your account at any time from Settings. We may suspend accounts that break these terms.</p>
        <h2>Contact</h2>
        <p>Questions? Email <a href={`mailto:${site.founder.email}`}>{site.founder.email}</a>.</p>
      </Prose>
    </>
  );
}
