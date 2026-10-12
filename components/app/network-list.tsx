"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { AlertCircle, Check, Link2, RefreshCw, Unplug } from "lucide-react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { connectNetwork, disconnectNetwork, finishConnection, submitNetworkCredentials, syncNetworks } from "@/app/_actions/social";
import { PLATFORM_META, type Platform } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

export type NetworkRow = {
  platform: Platform;
  accounts: { id: string; displayName: string | null; username: string | null; status: string }[];
  lastError: string | null;
};

type CredentialsPrompt = { platform: Platform; attemptId: string; fields: { name: string; label: string; type: string }[] };

export function NetworkList({
  rows,
  readiness,
  returnPath,
  unavailable = [],
}: {
  rows: NetworkRow[];
  readiness: { ready: boolean; message?: string };
  returnPath: "/onboarding" | "/app/connections";
  /** Networks the publishing provider can't connect yet; shown honestly instead of a failing button. */
  unavailable?: Platform[];
}) {
  const router = useRouter();
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [rowErrors, setRowErrors] = useState<Partial<Record<Platform, string>>>({});
  const [credentials, setCredentials] = useState<CredentialsPrompt | null>(null);
  const [pendingTab, setPendingTab] = useState<{ platform: Platform; attemptId: string } | null>(null);
  const [finishing, startFinish] = useTransition();
  const [syncing, startSync] = useTransition();

  async function connect(platform: Platform) {
    setConnecting(platform);
    setRowErrors((e) => ({ ...e, [platform]: undefined }));
    // Open the tab during the click so pop-up blockers allow it; point it at the link once it's ready.
    const tab = window.open("about:blank", "_blank");
    const result = await connectNetwork(platform, returnPath);
    if (!result.ok) {
      tab?.close();
      setConnecting(null);
      setRowErrors((e) => ({ ...e, [platform]: result.error.message }));
      return;
    }
    if (result.data.kind === "redirect") {
      if (result.data.newTab && tab) {
        tab.opener = null;
        tab.location.href = result.data.url;
        setConnecting(null);
        setPendingTab({ platform, attemptId: result.data.attemptId });
        return;
      }
      tab?.close();
      // Keep "Connecting…" visible while the browser leaves for the network.
      window.location.assign(result.data.url);
      return;
    }
    tab?.close();
    setConnecting(null);
    setCredentials({ platform, attemptId: result.data.attemptId, fields: result.data.fields });
  }

  function finish() {
    if (!pendingTab) return;
    startFinish(async () => {
      const result = await finishConnection(pendingTab.attemptId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setPendingTab(null);
      toast.success(result.data.connected === 1 ? "Account connected." : `${result.data.connected} accounts connected.`);
      router.refresh();
    });
  }

  async function disconnect(accountId: string, platform: Platform) {
    const result = await disconnectNetwork(accountId);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(
      result.data.providerRevoked
        ? `${PLATFORM_META[platform].name} disconnected.`
        : `${PLATFORM_META[platform].name} disconnected from Postory — it won't be used for posting. To revoke access entirely, remove it on the network's connected-apps page too.`,
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence>
        {pendingTab ? (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <Notice
              tone="info"
              title={`Finish connecting ${PLATFORM_META[pendingTab.platform].name} in the new tab`}
              action={
                <div className="flex gap-2">
                  <Button size="sm" variant="accent" loading={finishing} onClick={finish}>
                    I&apos;ve connected it
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPendingTab(null)} disabled={finishing}>
                    Cancel
                  </Button>
                </div>
              }
            >
              Sign in and approve access there, then come back here. You can connect several networks in that tab at once.
            </Notice>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!readiness.ready && readiness.message ? (
        <Notice tone="info" title="Connecting networks isn't available yet">
          {readiness.message}
        </Notice>
      ) : null}

      <ul className="stagger-in divide-y divide-line overflow-hidden rounded-3xl bg-surface shadow-soft ring-1 ring-line">
        {rows.map((row) => {
          const meta = PLATFORM_META[row.platform];
          const connected = row.accounts.filter((a) => a.status === "connected");
          const needsReconnect = row.accounts.filter((a) => a.status === "reconnect_required" || a.status === "error");
          const isConnecting = connecting === row.platform;
          const error = rowErrors[row.platform] ?? (connected.length === 0 ? row.lastError : null);

          let state: { label: string; tone: string; icon: React.ReactNode };
          if (isConnecting) state = { label: "Connecting…", tone: "text-blue-600", icon: <RefreshCw className="size-3.5 animate-spin" /> };
          else if (needsReconnect.length) state = { label: "Reconnect required", tone: "text-warning", icon: <AlertCircle className="size-3.5" /> };
          else if (connected.length) state = { label: "Connected", tone: "text-success", icon: <Check className="size-3.5" /> };
          else if (error) state = { label: "Connection failed", tone: "text-danger", icon: <AlertCircle className="size-3.5" /> };
          else if (unavailable.includes(row.platform)) state = { label: "Coming soon", tone: "text-faint", icon: null };
          else state = { label: "Not connected", tone: "text-muted", icon: null };

          return (
            <li key={row.platform} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-4 sm:px-5">
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
                <PlatformIcon platform={row.platform} tile className="size-10 rounded-xl" />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold tracking-[-0.01em]">{meta.name}</p>
                  <p className={cn("flex items-center gap-1.5 text-[13px]", state.tone)}>
                    {state.icon}
                    <span className="truncate">
                      {state.label}
                      {[...connected, ...needsReconnect].length
                        ? ` · ${[...connected, ...needsReconnect].map((a) => a.username ?? a.displayName ?? "Account").join(", ")}`
                        : ""}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {[...connected, ...needsReconnect].map((account) => (
                  <ConfirmButton
                    key={account.id}
                    size="sm"
                    variant="ghost"
                    icon={<Unplug className="size-3.5" />}
                    title={`Disconnect ${account.username ?? meta.name}?`}
                    description="Postory will stop posting to this account. Your existing stories and posts stay in your library."
                    confirmLabel="Disconnect"
                    onConfirm={() => disconnect(account.id, row.platform)}
                  >
                    Disconnect
                  </ConfirmButton>
                ))}
                {(needsReconnect.length || connected.length === 0) && !unavailable.includes(row.platform) ? (
                  <Button
                    size="sm"
                    variant={needsReconnect.length ? "accent" : "secondary"}
                    icon={<Link2 className="size-3.5" />}
                    loading={isConnecting}
                    disabled={!readiness.ready || (connecting !== null && !isConnecting)}
                    onClick={() => connect(row.platform)}
                  >
                    {needsReconnect.length ? "Reconnect" : "Connect"}
                  </Button>
                ) : null}
              </div>
              <AnimatePresence>
                {error ? (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    role="alert"
                    className="basis-full text-[13px] leading-relaxed text-danger sm:pl-[54px]"
                  >
                    {error}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>

      {readiness.ready ? (
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />}
            disabled={syncing}
            onClick={() =>
              startSync(async () => {
                const result = await syncNetworks();
                if (result.ok) {
                  toast.success("Accounts refreshed.");
                  router.refresh();
                } else toast.error(result.error.message);
              })
            }
          >
            Refresh connections
          </Button>
        </div>
      ) : null}

      <CredentialsDialog prompt={credentials} onClose={() => setCredentials(null)} onDone={() => router.refresh()} />
    </div>
  );
}

function CredentialsDialog({ prompt, onClose, onDone }: { prompt: CredentialsPrompt | null; onClose: () => void; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!prompt) return null;
  const name = PLATFORM_META[prompt.platform].name;
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Connect ${name}`}
      description={
        prompt.platform === "bluesky"
          ? "Use an app password from Bluesky settings, not your main password. You can revoke it any time."
          : undefined
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
          setError(null);
          startTransition(async () => {
            const result = await submitNetworkCredentials(prompt.attemptId, data);
            if (!result.ok) {
              setError(result.error.message);
              return;
            }
            toast.success(`${name} connected.`);
            onClose();
            onDone();
          });
        }}
      >
        {error ? <Notice tone="danger" title={error} /> : null}
        {prompt.fields.map((f) => (
          <Field key={f.name} label={f.label} htmlFor={`cred-${f.name}`}>
            <Input id={`cred-${f.name}`} name={f.name} type={f.type === "password" ? "password" : "text"} required autoComplete="off" />
          </Field>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            Connect
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
