"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { selectKeywordOpportunityAction } from "@/app/(app)/seo/actions";
import type { KeywordOpportunity } from "@/server/schemas/content";

export function GenerateArticleModal({
  productId,
  opportunities,
}: {
  productId: string;
  opportunities: KeywordOpportunity[];
}) {
  const [open, setOpen] = useState(false);
  const defaultOpportunityId = opportunities[0]?.id ?? "";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!opportunities.length}
        className="inline-flex h-8 items-center gap-2 rounded-[7px] bg-primary px-3 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Generate article
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-[10px] border border-border bg-card shadow-xl">
            <div className="border-b px-5 py-4">
              <h2 className="font-serif text-lg">Generate article</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick a keyword opportunity. LaunchBeacon will draft it in the background and send the result to the Inbox.
              </p>
            </div>
            <form action={selectKeywordOpportunityAction} className="space-y-4 p-5">
              <input type="hidden" name="productId" value={productId} />
              <label className="flex flex-col gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Keyword</span>
                <select
                  name="opportunityId"
                  defaultValue={defaultOpportunityId}
                  required
                  className="h-10 rounded-md border bg-background px-3 text-sm text-foreground"
                >
                  {opportunities.map((opportunity) => (
                    <option key={opportunity.id} value={opportunity.id}>
                      {opportunity.targetKeyword} - priority {opportunity.priorityScore}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-8 items-center rounded-[7px] border px-3 text-xs font-medium text-muted-foreground"
                >
                  Cancel
                </button>
                <SubmitButton />
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-8 items-center rounded-[7px] bg-primary px-3 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Starting..." : "Generate draft"}
    </button>
  );
}
