import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { aiRouter, buildLaunchBeaconSystemPrompt } from "@/server/ai";
import type { MarketingBrief } from "@/server/schemas/brief";
import type { OutreachContact } from "@/server/schemas/outreach";

export type OutreachEmailDraft = {
  subject: string;
  body: string;
  confidence: number;
  rationale: string;
};

const outreachEmailDraftSchema = z.object({
  subject: z.string().min(8).max(120),
  body: z.string().min(220).max(4000),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(20).max(700),
});

const outreachEmailDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    subject: { type: "string" },
    body: { type: "string" },
    confidence: { type: "number" },
    rationale: { type: "string" },
  },
  required: ["subject", "body", "confidence", "rationale"],
};

export async function buildOutreachDraft(input: {
  supabase: SupabaseClient;
  productId: string;
  userId?: string;
  productName: string;
  productUrl: string;
  brief: MarketingBrief;
  contact: OutreachContact;
}): Promise<OutreachEmailDraft> {
  const result = await aiRouter.generateText({
    supabase: input.supabase,
    productId: input.productId,
    userId: input.userId,
    taskClass: "outreach_email_draft",
    system: buildLaunchBeaconSystemPrompt({
      brief: input.brief,
      extraInstructions: [
        "You draft review-gated founder outreach emails for writers, bloggers, newsletter editors, and publication contacts.",
        "Use the prospect's real publication context. Do not invent a relationship, readership numbers, quotes, article history, or personal details.",
        "Make the pitch specific, useful, and low-pressure. The product mention should be clear but not breathless.",
        "Do not use hype, fake flattery, emojis, tracking links, spam phrasing, or manipulative urgency.",
        "Return strict JSON only. Do not wrap JSON in markdown.",
      ].join(" "),
    }),
    prompt: [
      "Draft a personalized outreach email for this prospect.",
      "The email should be ready for human review before sending.",
      "Subject should be specific and under 90 characters.",
      "Body should be 90-220 words, plain text, and include a clear reason the product could fit the publication.",
      "If the prospect email is missing, still write the draft, but do not imply it can be sent yet.",
      "Score confidence from 0 to 1 based on prospect fit and how grounded the pitch is.",
      "Return JSON matching this shape:",
      "{ subject: string; body: string; confidence: number; rationale: string }",
      "Product context:",
      JSON.stringify(
        {
          productName: input.productName,
          productUrl: input.productUrl,
          tagline: input.brief.tagline,
          valueProps: input.brief.valueProps,
          personas: input.brief.personas,
          toneProfile: input.brief.toneProfile,
          competitorReferences: input.brief.competitors,
        },
        null,
        2,
      ),
      "Prospect context:",
      JSON.stringify(
        {
          name: input.contact.name,
          emailAvailable: Boolean(input.contact.email),
          publication: input.contact.publication,
          url: input.contact.url,
          score: input.contact.score,
          provenance: getRelevantProvenance(input.contact),
        },
        null,
        2,
      ),
    ].join("\n\n"),
    maxOutputTokens: 1500,
    temperature: 0.35,
    responseMimeType: "application/json",
    responseJsonSchema: outreachEmailDraftJsonSchema,
    metadata: {
      stage: "outreach_email_draft",
      contactId: input.contact.id,
      publication: input.contact.publication,
      emailAvailable: Boolean(input.contact.email),
    },
  });

  return parseJsonResult(result.text);
}

function getRelevantProvenance(contact: OutreachContact) {
  const allowedKeys = [
    "source",
    "articleUrl",
    "articleTitle",
    "articleDescription",
    "profileUrl",
    "seedKeyword",
    "category",
    "reason",
    "rationale",
    "contactStatus",
    "generatedAt",
  ];

  return Object.fromEntries(
    Object.entries(contact.provenance).filter(([key, value]) => {
      if (!allowedKeys.includes(key)) {
        return false;
      }

      return value !== null && value !== undefined && value !== "";
    }),
  );
}

function parseJsonResult(text: string): OutreachEmailDraft {
  const parsed = safeJsonParse(extractJsonObject(text));
  const result = outreachEmailDraftSchema.safeParse(parsed);

  if (!result.success) {
    throw new OutreachDraftParseError(
      `outreach draft response did not match the required schema: ${result.error.message}`,
    );
  }

  return {
    ...result.data,
    confidence: clampScore(result.data.confidence),
  };
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new OutreachDraftParseError(
      `outreach draft response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function clampScore(value: number) {
  return Math.min(1, Math.max(0, Number(value.toFixed(4))));
}

export class OutreachDraftParseError extends Error {
  constructor(message: string) {
    super(`Outreach draft AI output could not be parsed: ${message}`);
    this.name = "OutreachDraftParseError";
  }
}
