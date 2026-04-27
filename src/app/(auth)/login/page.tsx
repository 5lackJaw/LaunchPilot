import type { Metadata } from "next";
import { AuthForm } from "@/app/(auth)/auth-form";
import { signInAction } from "@/app/(auth)/auth-actions";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <AuthPageShell eyebrow="Welcome back">
      <AuthForm
        title="Sign in"
        description="Continue to product onboarding and review work."
        submitLabel="Sign in"
        alternateHref="/signup"
        alternateLabel="Create an account"
        action={signInAction}
      />
    </AuthPageShell>
  );
}

function AuthPageShell({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-10 text-foreground">
      <div className="flex w-full max-w-md flex-col gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{eyebrow}</p>
          <h1 className="font-serif text-2xl italic">LaunchBeacon</h1>
        </div>
        {children}
      </div>
    </main>
  );
}
