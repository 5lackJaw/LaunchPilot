import type { Metadata } from "next";
import { AuthForm } from "@/app/(auth)/auth-form";
import { signUpAction } from "@/app/(auth)/auth-actions";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignupPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-10 text-foreground">
      <div className="flex w-full max-w-md flex-col gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Start onboarding</p>
          <h1 className="font-serif text-2xl italic">LaunchBeacon</h1>
        </div>
        <AuthForm
          title="Create account"
          description="Create your account, then add the product URL to start onboarding."
          submitLabel="Create account"
          alternateHref="/login"
          alternateLabel="Sign in instead"
          action={signUpAction}
        />
      </div>
    </main>
  );
}
