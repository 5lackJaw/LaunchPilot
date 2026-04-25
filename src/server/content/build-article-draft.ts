import type { ContentAsset } from "@/server/schemas/content";
import type { MarketingBrief } from "@/server/schemas/brief";

export function buildArticleDraft(input: { asset: ContentAsset; brief: MarketingBrief; productName: string }) {
  const keyword = input.asset.targetKeyword ?? input.asset.title.toLowerCase();
  const audience = input.brief.personas[0] ?? "technical founders";
  const primaryValue = input.brief.valueProps[0] ?? input.brief.tagline;
  const secondValue = input.brief.valueProps[1] ?? "reduce manual marketing work";
  const proof = input.brief.valueProps[2] ?? "keep every execution step reviewable";
  const title = input.asset.title;
  const metaTitle = input.asset.metaTitle || title.slice(0, 70);
  const metaDescription =
    input.asset.metaDescription ||
    `${title} for ${audience.toLowerCase()}. Learn when it matters, what to check, and how ${input.productName} fits the workflow.`.slice(0, 300);

  const bodyMd = `# ${title}

## Why this matters

${audience} usually do not need more marketing dashboards. They need a practical way to turn a clear product position into repeatable execution. This article focuses on **${keyword}** from that angle.

${input.brief.tagline}

## The short version

- ${primaryValue}
- ${secondValue}
- ${proof}

## What to look for

Start by checking whether the reader already understands the problem. If they do, the article should move quickly from context to action. If they do not, lead with the pain point and explain the trigger that makes the problem urgent.

For ${keyword}, the useful checks are:

1. Whether the workflow saves time without hiding important decisions.
2. Whether the output can be reviewed before anything is published.
3. Whether the result creates durable traffic or only short-lived activity.

## How ${input.productName} approaches it

${input.productName} keeps the user focused on product decisions and review. The system can prepare draft assets, surface them in the approval inbox, and leave the final decision visible and auditable.

That matters because low-confidence automation should not publish by default. The safer path is to generate the draft, explain why it was recommended, and ask for approval before execution.

## Practical next step

Use this topic as a focused content asset first. After the draft is reviewed, publish it through the appropriate integration or export it as Markdown. Then watch whether the keyword and source data justify follow-up articles.

## Review notes

This draft was generated from the current Marketing Brief and should be reviewed for specificity, claims, examples, and product accuracy before publishing.
`;

  return {
    title,
    bodyMd,
    metaTitle,
    metaDescription,
    aiConfidence: 0.87,
  };
}
