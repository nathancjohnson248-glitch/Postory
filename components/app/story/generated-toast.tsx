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
    toast.success("Your posts are ready for review.");
    router.replace(pathname, { scroll: false });
  }, [params, pathname, router]);
  return null;
}
