import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function InboxAuthRequired() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to view the inbox</CardTitle>
          <CardDescription>
            The Approval Inbox is product-scoped, so LaunchPilot only loads it after Supabase confirms your session.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/signup">Create account</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
