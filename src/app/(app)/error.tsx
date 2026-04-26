"use client";

import { AlertTriangle } from "lucide-react";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar title="LaunchPilot" eyebrow="Application error" />
      <div className="p-6">
        <EmptyState
          icon={AlertTriangle}
          title="This view could not be loaded"
          description="The server could not finish rendering this workspace view. Retry once, then check the latest logs if it repeats."
          action={
            <Button type="button" size="sm" onClick={reset}>
              Retry
            </Button>
          }
        />
      </div>
    </main>
  );
}
