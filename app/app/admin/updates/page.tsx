import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProductUpdateComposer } from "@/components/admin/product-update-composer";
import { PageHeader } from "@/components/app/section";
import { Notice } from "@/components/ui/notice";
import { requireAdmin } from "@/lib/auth/admin";
import { env, integrations } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Product updates" };
export const maxDuration = 300;

export default async function ProductUpdatesPage() {
  const { user, role } = await requireAdmin();
  if (role !== "owner") notFound();

  const { count } = await createAdminClient().from("profiles").select("id", { count: "exact", head: true }).eq("product_updates", true).not("email", "is", null);
  const from = (integrations.zoho() ? env.zohoFrom() : env.smtpFrom()) ?? "";

  return (
    <>
      <PageHeader
        eyebrow="Owner"
        title="Product updates"
        description={`Email everyone who hasn't turned updates off${from ? `, from ${from.replace(/^.*<|>.*$/g, "")}` : ""}. The address only sends: replies aren't read, and every email says so.`}
        actions={
          <Link href="/app/admin" className="flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden /> Admin
          </Link>
        }
      />
      {integrations.email() ? (
        <section className="max-w-2xl rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-line">
          <ProductUpdateComposer recipients={count ?? 0} ownerEmail={user.email ?? "you"} />
        </section>
      ) : (
        <Notice tone="warning" title="No email sender is configured on this deployment." />
      )}
    </>
  );
}
