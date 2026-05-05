import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { aiRouter, buildLaunchBeaconSystemPrompt } from "@/server/ai";
import type { MarketingBrief } from "@/server/schemas/brief";
import type { CommunityThread } from "@/server/schemas/community";

export type CommunityReplyDraft = {
  body: string;
  promotionalScore: number;
  confidence: number;
  rationale: string;
};

export type CommunityReplyGuardrail = {
  authenticityScore: number;
  promotionalScore: number;
  passes: boolean;
  rationale: string;
};

const communityReplyDraftSchema = z.object({
  body: z.string().min(180).max(2400),
  promotionalScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(20).max(700),
});

const communityReplyGuardrailSchema = z.object({
  authenticityScore: z.number().min(0).max(1),
  promotionalScore: z.number().min(0).max(1),
  passes: z.boolean(),
  rationale: z.string().min(20).max(700),
});

const communityReplyDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    body: { type: "string" },
    promotionalScore: { type: "number" },
    confidence: { type: "number" },
    rationale: { type: "string" },
  },
  required: ["body", "promotionalScore", "confidence", "rationale"],
};

const communityReplyGuardrailJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    authenticityScore: { type: "number" },
    promotionalScore: { type: "number" },
    passes: { type: "boolean" },
    rationale: { type: "string" },
  },
  required: ["authenticityScore", "promotionalScore", "passes", "rationale"],
};

export async function buildCommunityReplyDraft(input: {
  supabase: SupabaseClient;
  productId: string;
  userId?: string;
  productName: string;
  brief: MarketingBrief;
  thread: CommunityThread;
}): Promise<CommunityReplyDraft> {
  const result = await aiRouter.generateText({
    supabase: input.supabase,
    productId: input.productId,
    userId: input.userId,
    taskClass: "community_reply_draft",
    system: buildLaunchBeaconSystemPrompt({
      brief: input.brief,
      extraInstructions: [
        "You draft review-gated community replies for Reddit, Hacker News, and similar public threads.",
        "Lead with genuine value. The first sentence must not name the product.",
        "Mention the product only if it is naturally useful, and keep that mention secondary.",
        "Do not use hype, fake personal anecdotes, invented facts, emojis, hashtags, tracking links, or sales CTAs.",
        "Return strict JSON only. Do not wrap JSON in markdown.",
      ].join(" "),
    }),
    prompt: [
      "Draft a helpful community reply for this thread.",
      "The reply should sound like a knowledgeable peer, not a brand account.",
      "If the product is not directly useful to mention, omit the product mention.",
      "Score promotionalScore from 0 to 1, where 0 is purely helpful and 1 is overtly promotional.",
      "Score confidence from 0 to 1 based on thread fit and how safely the reply can help.",
      "Return JSON matching this shape:",
      "{ body: string; promotionalScore: number; confidence: number; rationale: string }",
      "Product context:",
      JSON.stringify(
        {
          productName: input.productName,
          tagline: input.brief.tagline,
          valueProps: input.brief.valueProps,
          personas: input.brief.personas,
          toneProfile: input.brief.toneProfile,
        },
        null,
        2,
      ),
      "Thread context:",
      JSON.stringify(
        {
          platform: input.thread.platform,
          title: input.thread.threadTitle,
          author: input.thread.threadAuthorHandle,
          url: input.thread.threadUrl,
          bodySnippet: getThreadBodySnippet(input.thread),
          relevanceScore: input.thread.relevanceScore,
          painSignalScore: input.thread.painSignalScore,
          audienceFitScore: input.thread.audienceFitScore,
          recencyScore: input.thread.recencyScore,
        },
        null,
        2,
      ),
    ].join("\n\n"),
    maxOutputTokens: 1800,
    temperature: 0.35,
    responseMimeType: "application/json",
    responseJsonSchema: communityReplyDraftJsonSchema,
    metadata: {
      stage: "community_reply_draft",
      threadId: input.thread.id,
      platform: input.thread.platform,
    },
  });

  return parseJsonResult(result.text);
}

export async function scoreCommunityReplyGuardrails(input: {
  supabase: SupabaseClient;
  productId: string;
  userId?: string;
  productName: string;
  brief: MarketingBrief;
  thread: CommunityThread;
  draft: CommunityReplyDraft;
}): Promise<CommunityReplyGuardrail> {
  const result = await aiRouter.generateText({
    supabase: input.supabase,
    productId: input.productId,
    userId: input.userId,
    taskClass: "authenticity_scoring",
    system: buildLaunchBeaconSystemPrompt({
      extraInstructions:
        "You are a strict community moderation and authenticity reviewer. Score whether a reply is genuinely helpful and low-promotion. Return strict JSON only.",
    }),
    prompt: [
      "Review this proposed community reply before it reaches the approval inbox.",
      "authenticityScore: 0 means obviously promotional or fake; 1 means natural, useful, and context-aware.",
      "promotionalScore: 0 means no promotion; 1 means overt pitch or brand spam.",
      "passes should be true only when authenticityScore >= 0.65 and promotionalScore <= 0.45.",
      "Return JSON matching this shape:",
      "{ authenticityScore: number; promotionalScore: number; passes: boolean; rationale: string }",
      "Product context:",
      JSON.stringify(
        {
          productName: input.productName,
          tagline: input.brief.tagline,
          valueProps: input.brief.valueProps,
          personas: input.brief.personas,
          toneProfile: input.brief.toneProfile,
        },
        null,
        2,
      ),
      "Thread context:",
      JSON.stringify(
        {
          platform: input.thread.platform,
          title: input.thread.threadTitle,
          bodySnippet: getThreadBodySnippet(input.thread),
          threadScores: {
            relevance: input.thread.relevanceScore,
            painSignal: input.thread.painSignalScore,
            audienceFit: input.thread.audienceFitScore,
          },
        },
        null,
        2,
      ),
      "Draft to review:",
      input.draft.body,
    ].join("\n\n"),
    maxOutputTokens: 900,
    temperature: 0.1,
    responseMimeType: "application/json",
    responseJsonSchema: communityReplyGuardrailJsonSchema,
    metadata: {
      stage: "community_reply_guardrail",
      threadId: input.thread.id,
      platform: input.thread.platform,
    },
  });

  return parseGuardrailJsonResult(result.text);
}

function getThreadBodySnippet(thread: CommunityThread) {
  const bodySnippet = thread.provenance.bodySnippet;
  return typeof bodySnippet === "string" ? bodySnippet.slice(0, 1200) : "";
}

function parseJsonResult(text: string): CommunityReplyDraft {
  const parsed = safeJsonParse(extractJsonObject(text));
  const result = communityReplyDraftSchema.safeParse(parsed);

  if (!result.success) {
    throw new CommunityReplyDraftParseError(
      `community reply draft response did not match the required schema: ${result.error.message}`,
    );
  }

  return {
    ...result.data,
    promotionalScore: clampScore(result.data.promotionalScore),
    confidence: clampScore(result.data.confidence),
  };
}

function parseGuardrailJsonResult(text: string): CommunityReplyGuardrail {
  const parsed = safeJsonParse(extractJsonObject(text));
  const result = communityReplyGuardrailSchema.safeParse(parsed);

  if (!result.success) {
    throw new CommunityReplyDraftParseError(
      `community reply guardrail response did not match the required schema: ${result.error.message}`,
    );
  }

  const authenticityScore = clampScore(result.data.authenticityScore);
  const promotionalScore = clampScore(result.data.promotionalScore);

  return {
    ...result.data,
    authenticityScore,
    promotionalScore,
    passes: result.data.passes && authenticityScore >= 0.65 && promotionalScore <= 0.45,
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
    throw new CommunityReplyDraftParseError(
      `community reply draft response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function clampScore(value: number) {
  return Math.min(1, Math.max(0, Number(value.toFixed(4))));
}

export class CommunityReplyDraftParseError extends Error {
  constructor(message: string) {
    super(`Community reply AI output could not be parsed: ${message}`);
    this.name = "CommunityReplyDraftParseError";
  }
}
