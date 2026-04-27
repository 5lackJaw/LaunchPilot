"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function CrawlStatusRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [enabled, router]);

  if (!enabled) {
    return null;
  }

  return <p className="font-mono text-[10.5px] text-muted-foreground">Refreshing crawl status automatically.</p>;
}
