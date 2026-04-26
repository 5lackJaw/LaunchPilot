import type { MarketingBrief } from "@/server/schemas/brief";
import type { OutreachContact } from "@/server/schemas/outreach";

export type OutreachEmailDraft = {
  subject: string;
  body: string;
  confidence: number;
  rationale: string;
};

export function buildOutreachDraft(input: { productName: string; productUrl: string; brief: MarketingBrief; contact: OutreachContact }): OutreachEmailDraft {
  const valueProp = input.brief.valueProps[0] ?? input.brief.tagline;
  const persona = input.brief.personas[0] ?? "indie founders";
  const publication = input.contact.publication ?? "your publication";
  const hook = input.contact.provenance.seedKeyword;
  const keywordHook = typeof hook === "string" ? hook : input.brief.keywordClusters[0]?.name ?? input.productName;

  return {
    subject: `${input.productName} story for ${publication}`,
    body: [
      `Hi ${firstName(input.contact.name)},`,
      "",
      `I noticed ${publication} covers practical problems around ${keywordHook}. ${input.productName} may be relevant because it helps ${persona} with ${valueProp.toLowerCase()}.`,
      "",
      `The useful angle is not a product announcement. It is the workflow behind reducing repeated launch marketing work into a short review queue with clear approval points.`,
      "",
      `If that is useful, I can send a short founder note with concrete examples and screenshots: ${input.productUrl}`,
      "",
      "Best,",
      "Chris",
    ].join("\n"),
    confidence: clampScore(0.72 + input.contact.score * 0.22),
    rationale: `Drafted from the current Marketing Brief, prospect score, publication fit, and the "${keywordHook}" hook.`,
  };
}

function firstName(name: string) {
  const first = name.split(/\s+/)[0];
  return first && first.toLowerCase() !== "editor" ? first : "there";
}

function clampScore(value: number) {
  return Math.min(1, Math.max(0, Number(value.toFixed(4))));
}
