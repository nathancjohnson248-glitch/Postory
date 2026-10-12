"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PrivyProvider, useLoginWithOAuth, usePrivy } from "@privy-io/react-auth";
import { completeGoogleSignIn } from "@/app/(auth)/actions";
import { GoogleGlyph } from "@/components/onboarding/google-button";
import { Button } from "@/components/ui/button";

const NEXT_KEY = "postory_google_next";

function store(key: string, value?: string) {
  try {
    if (value === undefined) return sessionStorage.getItem(key);
    sessionStorage.setItem(key, value);
  } catch {
    // Storage blocked: fall back to the default destination.
  }
  return null;
}

/**
 * Google sign-in, start to finish, on one page:
 * 1. first visit → Privy sends the browser to Google;
 * 2. Google sends it back here → Privy finishes the login;
 * 3. the Privy access token goes to the server, which opens the Postory
 *    session for the verified Google address, then Privy's own session is
 *    dropped — Postory doesn't keep it.
 */
function Flow({ next }: { next: string }) {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();
  const { initOAuth, state } = useLoginWithOAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ready || started.current || error) return;
    const params = new URLSearchParams(window.location.search);
    const returning = params.has("privy_oauth_code") || params.has("privy_oauth_state");

    if (authenticated) {
      started.current = true;
      void (async () => {
        const token = await getAccessToken();
        const result = token ? await completeGoogleSignIn(token, store(NEXT_KEY) ?? next) : { error: "Google sign-in didn't go through. Try again." };
        await logout().catch(() => undefined);
        if ("error" in result) {
          setError(result.error);
          return;
        }
        window.location.replace(result.next);
      })();
      return;
    }
    // Privy is finishing the redirect from Google; wait for it.
    if (returning) return;

    started.current = true;
    store(NEXT_KEY, next);
    initOAuth({ provider: "google" }).catch(() => setError("Google sign-in couldn't start. Try again."));
  }, [ready, authenticated, error, getAccessToken, initOAuth, logout, next]);

  const failed = error ?? (state.status === "error" ? "Google didn't complete the sign-in. Try again." : null);

  return (
    <div className="flex flex-col items-start">
      <span className="grid size-12 place-items-center rounded-2xl bg-surface shadow-soft ring-1 ring-line">
        <GoogleGlyph />
      </span>
      {failed ? (
        <>
          <h1 className="mt-6 font-display text-[40px] leading-none tracking-[-0.02em]">That didn&apos;t work.</h1>
          <p className="mt-3 text-[15px] text-muted">{failed}</p>
          <div className="mt-8 flex w-full flex-col gap-3">
            <Button size="lg" className="w-full" onClick={() => window.location.replace(`/auth/google?next=${encodeURIComponent(next)}`)}>
              Try Google again
            </Button>
            <Link href="/login" className="text-center text-sm font-medium text-muted hover:text-ink">
              Use email instead
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-6 font-display text-[40px] leading-none tracking-[-0.02em]">Connecting to Google…</h1>
          <p className="mt-3 text-[15px] text-muted">Hang on — you&apos;ll be in Postory in a moment.</p>
          <div className="mt-8 h-1 w-full overflow-hidden rounded-full bg-wash">
            <div className="h-full w-1/3 animate-[indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-blue-500" />
          </div>
        </>
      )}
    </div>
  );
}

export function GoogleBridge({ appId, next }: { appId: string; next: string }) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["google"],
        // Postory is a normal SaaS: no wallets, ever.
        embeddedWallets: { ethereum: { createOnLogin: "off" }, solana: { createOnLogin: "off" }, showWalletUIs: false },
        appearance: { theme: "light", accentColor: "#2F5BFF", showWalletLoginFirst: false },
      }}
    >
      <Flow next={next} />
    </PrivyProvider>
  );
}
