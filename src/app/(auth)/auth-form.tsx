"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthFormState } from "@/app/(auth)/auth-actions";

const initialState: AuthFormState = {
  status: "idle",
};

type AuthFormProps = {
  title: string;
  description: string;
  submitLabel: string;
  alternateHref: string;
  alternateLabel: string;
  action: (previousState: AuthFormState, formData: FormData) => Promise<AuthFormState>;
};

export function AuthForm({ title, description, submitLabel, alternateHref, alternateLabel, action }: AuthFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {state.status !== "idle" ? (
            <Alert variant={state.status === "error" ? "destructive" : "default"}>
              <AlertTitle>{state.status === "error" ? "Action needed" : "Next step"}</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" aria-describedby="email-error" />
            {state.fieldErrors?.email ? (
              <p id="email-error" className="text-xs text-destructive">
                {state.fieldErrors.email[0]}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={submitLabel === "Create account" ? "new-password" : "current-password"}
              aria-describedby="password-error"
            />
            {state.fieldErrors?.password ? (
              <p id="password-error" className="text-xs text-destructive">
                {state.fieldErrors.password[0]}
              </p>
            ) : null}
          </div>

          <SubmitButton label={submitLabel} />

          <Button asChild variant="ghost">
            <Link href={alternateHref}>{alternateLabel}</Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Working..." : label}
    </Button>
  );
}
