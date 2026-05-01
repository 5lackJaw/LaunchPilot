"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function WorkflowStatusRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [enabled, router]);

  return null;
}
