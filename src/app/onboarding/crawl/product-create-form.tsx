"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProductAction, type ProductCreateFormState } from "@/app/onboarding/crawl/actions";

const initialState: ProductCreateFormState = {
  status: "idle",
};

export function ProductCreateForm() {
  const [state, formAction] = useActionState(createProductAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Product was not created</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Product name</Label>
        <Input id="name" name="name" placeholder="Acme Analytics" autoComplete="organization" aria-describedby="name-error" />
        {state.fieldErrors?.name ? (
          <p id="name-error" className="text-xs text-destructive">
            {state.fieldErrors.name[0]}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="url">Product URL</Label>
        <Input id="url" name="url" type="url" placeholder="https://example.com" autoComplete="url" aria-describedby="url-error" />
        {state.fieldErrors?.url ? (
          <p id="url-error" className="text-xs text-destructive">
            {state.fieldErrors.url[0]}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating..." : "Create product"}
    </Button>
  );
}
