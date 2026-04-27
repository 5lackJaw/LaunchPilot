"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { startCrawlAction, type CrawlStartFormState } from "@/app/onboarding/crawl/actions";

const initialState: CrawlStartFormState = {
  status: "idle",
};

export function StartCrawlForm({ productId, disabled }: { productId: string; disabled?: boolean }) {
  const [state, formAction] = useActionState(startCrawlAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Crawl was not started</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <input type="hidden" name="productId" value={productId} />
      <SubmitButton disabled={disabled} disabledLabel="Crawl in progress" />
    </form>
  );
}

function SubmitButton({ disabled, disabledLabel }: { disabled?: boolean; disabledLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? "Starting crawl..." : disabled ? disabledLabel : "Start crawl"}
    </Button>
  );
}
