import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Mailbox } from "@/components/admin/mailbox";
import { PageHeader } from "@/components/app/section";
import { Notice } from "@/components/ui/notice";
import { requireAdmin } from "@/lib/auth/admin";
import { env, integrations } from "@/lib/env";
import { listFolders, listMessages, ZohoScopeError, type MailFolder, type MailSummary } from "@/lib/email/zoho";
import { log } from "@/lib/log";

export const metadata: Metadata = { title: "Mail" };

const ADDRESS = () => env.zohoFrom().replace(/^.*<|>.*$/g, "");

export default async function MailPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const { role } = await requireAdmin();
  if (role !== "owner") notFound();
  const { folder } = await searchParams;

  const back = (
    <Link href="/app/admin" className="flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> Admin
    </Link>
  );

  if (!integrations.zoho()) {
    return (
      <>
        <PageHeader eyebrow="Owner" title="Mail" actions={back} />
        <Notice tone="info" title="The mailbox isn't connected on this deployment." />
      </>
    );
  }

  let folders: MailFolder[] = [];
  let messages: MailSummary[] = [];
  let problem: "scope" | "error" | null = null;
  let current = "";
  try {
    folders = (await listFolders()).sort((a, b) => order(a) - order(b));
    current = folders.find((f) => f.id === folder)?.id ?? folders.find((f) => f.type === "inbox")?.id ?? folders[0]?.id ?? "";
    messages = current ? await listMessages(current) : [];
  } catch (error) {
    if (error instanceof ZohoScopeError) problem = "scope";
    else {
      problem = "error";
      log.warn("mailbox load failed", { operation: "mail.load", provider: "zoho" }, error);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Owner" title="Mail" description={`Everything sent to ${ADDRESS()}. Read, reply and write new mail from Postory's address.`} actions={back} />
      {problem === "scope" ? (
        <Notice tone="warning" title="Postory can send from this mailbox but can't read it yet.">
          Zoho needs to grant read access: create a new code in api-console.zoho.com (Self Client → Generate Code) with the scope
          ZohoMail.messages.ALL,ZohoMail.folders.READ,ZohoMail.accounts.READ and reconnect.
        </Notice>
      ) : problem === "error" ? (
        <Notice tone="danger" title="Zoho couldn't be reached. Try again in a moment." />
      ) : (
        <Mailbox folders={folders} folderId={current} messages={messages} address={ADDRESS()} />
      )}
    </>
  );
}

const ORDER = ["inbox", "sent", "drafts", "spam", "trash"];
function order(f: MailFolder) {
  const i = ORDER.indexOf(f.type);
  return i === -1 ? ORDER.length : i;
}
