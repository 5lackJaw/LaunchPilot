import Link from "next/link";
import { SearchX } from "lucide-react";
import { AppTopbar } from "@/components/layout/app-topbar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AppNotFound() {
  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar title="LaunchPilot" eyebrow="Not found" />
      <div className="p-6">
        <EmptyState
          icon={SearchX}
          title="Workspace page not found"
          description="The route does not match a LaunchPilot workspace view, or the linked record is no longer available."
          action={
            <Button size="sm" asChild>
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          }
        />
      </div>
    </main>
  );
}
