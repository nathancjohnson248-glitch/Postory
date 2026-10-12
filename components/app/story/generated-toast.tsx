"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function GeneratedToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (params.get("generated") !== "1") return;
    if (params.get("missing")) toast.warning("Some posts need another attempt.");
    else toast.success("Your posts are ready for review.");
    // Keep `missing` so the retry card survives; drop only the one-shot flag.
    const next = new URLSearchParams(params);
    next.delete("generated");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }, [params, pathname, router]);
  return null;
}
