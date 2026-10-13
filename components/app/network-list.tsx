"use client";

import { showError } from "@/lib/client/show-error";
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
import { connectBlueskyAccount, connectNetwork, disconnectNetwork, finishConnection, syncNetworks } from "@/app/_actions/social";
import { PLATFORM_META, type Platform } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

export type NetworkRow = {
  platform: Platform;
  accounts: { id: string; displayName: string | null; username: string | null; status: string }[];
  lastError: string | null;
};

/** Whether each network can be connected now (from the server), and why not. */
export type Availability = Partial<Record<Platform, { available: boolean; reason?: string }>>;

export function NetworkList({
  rows,
  readiness,
  availability = {},
}: {
  rows: NetworkRow[];
  readiness: { ready: boolean; message?: string };
  availability?: Availability;
}) {
  const router = useRouter();
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [rowErrors, setRowErrors] = useState<Partial<Record<Platform, string>>>({});
  const [bluesky, setBluesky] = useState<{ attemptId: string } | null>(null);
  const [syncing, startSync] = useTransition();

  async function connect(platform: Platform) {
    setConnecting(platform);
    setRowErrors((e) => ({ ...e, [platform]: undefined }));
    const result = await connectNetwork(platform);
    if (!result.ok) {
      setConnecting(null);
      setRowErrors((e) => ({ ...e, [platform]: result.error.message }));
      return;
    }
    if (result.data.kind === "credentials") {
      setConnecting(null);
      setBluesky({ attemptId: result.data.attemptId });
      return;
    }
    // Nango's Connect UI opens over the page; the network's consent screen runs inside it.
    const attemptId = result.data.attemptId;
    const { default: Nango } = await import("@nangohq/frontend");
    let finished = false;
    new Nango().openConnectUI({
      sessionToken: result.data.token,
      onEvent: async (event) => {
        if (event.type === "connect" && !finished) {
          finished = true;
          const done = await finishConnection(attemptId);
          setConnecting(null);
          if (!done.ok) {
            setRowErrors((e) => ({ ...e, [platform]: done.error.message }));
            return;
          }
          toast.success(done.data.connected === 1 ? `${PLATFORM_META[platform].name} connected.` : `${done.data.connected} accounts connected.`);
          router.refresh();
        } else if (event.type === "close" && !finished) {
          setConnecting(null);
        } else if (event.type === "error") {
          setConnecting(null);
          setRowErrors((e) => ({ ...e, [platform]: event.payload.errorMessage || "The connection didn't finish. Try again." }));
        }
      },
    });
  }

  async function disconnect(accountId: string, platform: Platform) {
    const result = await disconnectNetwork(accountId);
    if (!result.ok) {
      showError(result.error);
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
          const unavailable = availability[row.platform]?.available === false;
          const can = [meta.can.publish && "Publish", meta.can.metrics && "Stats", meta.can.comments && "Comments"].filter(Boolean).join(" · ");

          let state: { label: string; tone: string; icon: React.ReactNode };
          if (isConnecting) state = { label: "Connecting…", tone: "text-blue-600", icon: <RefreshCw className="size-3.5 animate-spin" /> };
          else if (needsReconnect.length) state = { label: "Reconnect required", tone: "text-warning", icon: <AlertCircle className="size-3.5" /> };
          else if (connected.length) state = { label: "Connected", tone: "text-success", icon: <Check className="size-3.5" /> };
          else if (error) state = { label: "Connection failed", tone: "text-danger", icon: <AlertCircle className="size-3.5" /> };
          else if (unavailable) state = { label: meta.connect === "none" ? "Write-only" : "Not available yet", tone: "text-faint", icon: null };
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
                {(needsReconnect.length || connected.length === 0) && !unavailable ? (
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
              {unavailable || meta.limitation || can ? (
                <p className="basis-full text-[12.5px] leading-relaxed text-muted sm:pl-[54px]">
                  {unavailable ? availability[row.platform]?.reason : can ? `Postory can: ${can}.` : null}
                  {!unavailable && meta.limitation ? ` ${meta.limitation}` : null}
                </p>
              ) : null}
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
                } else showError(result.error);
              })
            }
          >
            Refresh connections
          </Button>
        </div>
      ) : null}

      <BlueskyDialog attemptId={bluesky?.attemptId ?? null} onClose={() => setBluesky(null)} onDone={() => router.refresh()} />
    </div>
  );
}

function BlueskyDialog({ attemptId, onClose, onDone }: { attemptId: string | null; onClose: () => void; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!attemptId) return null;
  return (
    <Dialog
      open
      onClose={onClose}
      title="Connect Bluesky"
      description="Bluesky connects with an app password, not your main password. It can post for you but can't change your account, and you can revoke it on Bluesky any time."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            const result = await connectBlueskyAccount(attemptId, { identifier: String(data.get("identifier") ?? ""), appPassword: String(data.get("appPassword") ?? "") });
            if (!result.ok) return setError(result.error.message);
            toast.success("Bluesky connected.");
            onClose();
            onDone();
          });
        }}
      >
        {error ? <Notice tone="danger" title={error} /> : null}
        <Field label="Bluesky handle" htmlFor="bsky-handle">
          <Input id="bsky-handle" name="identifier" placeholder="yourname.bsky.social" required autoComplete="username" autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field
          label="App password"
          htmlFor="bsky-password"
          hint={
            <>
              On Bluesky: Settings → Privacy and security → App passwords → Add. It looks like xxxx-xxxx-xxxx-xxxx.{" "}
              <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline">
                Open Bluesky settings
              </a>
            </>
          }
        >
          <Input id="bsky-password" name="appPassword" type="password" placeholder="xxxx-xxxx-xxxx-xxxx" required autoComplete="off" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" loading={pending}>
            Connect Bluesky
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
