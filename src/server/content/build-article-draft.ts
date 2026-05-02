import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { aiRouter, buildLaunchBeaconSystemPrompt } from "@/server/ai";
import type { ContentAsset } from "@/server/schemas/content";
import type { MarketingBrief } from "@/server/schemas/brief";

export type ArticleDraftPipelineInput = {
  supabase: SupabaseClient;
  asset: ContentAsset;
  brief: MarketingBrief;
  productName: string;
  userId?: string;
};

const searchIntentSchema = z.object({
  primaryIntent: z.string().min(8),
  searchStage: z.enum([
    "awareness",
    "consideration",
    "decision",
    "navigational",
  ]),
  readerProblems: z.array(z.string().min(6)).min(3).max(6),
  questionsToAnswer: z.array(z.string().min(6)).min(4).max(10),
  mustCover: z.array(z.string().min(6)).min(4).max(10),
  contentAngle: z.string().min(12),
});

const outlineSchema = z.object({
  title: z.string().min(10).max(120),
  metaTitle: z.string().min(10).max(120),
  introHook: z.string().min(20).max(500),
  sections: z
    .array(
      z.object({
        heading: z.string().min(6).max(120),
        points: z.array(z.string().min(6)).min(2).max(6),
      }),
    )
    .min(5)
    .max(10),
  internalLinkSuggestions: z.array(z.string().min(4)).min(2).max(8),
});

const articleDraftSchema = z.object({
  title: z.string().min(10).max(140),
  metaTitle: z.string().min(10).max(120),
  metaDescription: z.string().min(80).max(300),
  bodyMd: z.string().min(2500).max(30000),
});

const seoReviewSchema = z.object({
  aiConfidence: z.number().min(0).max(1),
  passes: z.boolean(),
  finalTitle: z.string().min(10).max(140),
  finalMetaTitle: z.string().min(10).max(120),
  finalMetaDescription: z.string().min(80).max(300),
  notes: z.array(z.string()).max(8),
});

const searchIntentJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    primaryIntent: { type: "string" },
    searchStage: {
      type: "string",
      enum: ["awareness", "consideration", "decision", "navigational"],
    },
    readerProblems: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: { type: "string" },
    },
    questionsToAnswer: {
      type: "array",
      minItems: 4,
      maxItems: 10,
      items: { type: "string" },
    },
    mustCover: {
      type: "array",
      minItems: 4,
      maxItems: 10,
      items: { type: "string" },
    },
    contentAngle: { type: "string" },
  },
  required: [
    "primaryIntent",
    "searchStage",
    "readerProblems",
    "questionsToAnswer",
    "mustCover",
    "contentAngle",
  ],
};

const seoReviewJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    aiConfidence: { type: "number" },
    passes: { type: "boolean" },
    finalTitle: { type: "string" },
    finalMetaTitle: { type: "string" },
    finalMetaDescription: { type: "string" },
    notes: { type: "array", maxItems: 8, items: { type: "string" } },
  },
  required: [
    "aiConfidence",
    "passes",
    "finalTitle",
    "finalMetaTitle",
    "finalMetaDescription",
    "notes",
  ],
};

const outlineJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    metaTitle: { type: "string" },
    introHook: { type: "string" },
    sections: {
      type: "array",
      minItems: 5,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          heading: { type: "string" },
          points: {
            type: "array",
            minItems: 2,
            maxItems: 6,
            items: { type: "string" },
          },
        },
        required: ["heading", "points"],
      },
    },
    internalLinkSuggestions: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: { type: "string" },
    },
  },
  required: [
    "title",
    "metaTitle",
    "introHook",
    "sections",
    "internalLinkSuggestions",
  ],
};

const articleDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    metaTitle: { type: "string" },
    metaDescription: { type: "string" },
    bodyMd: { type: "string" },
  },
  required: ["title", "metaTitle", "metaDescription", "bodyMd"],
};

export async function buildArticleDraft(input: ArticleDraftPipelineInput) {
  const searchIntent = await researchSearcherIntent(input);
  const outline = await generateArticleOutline({ ...input, searchIntent });
  const draft = await generateFullArticleDraft({
    ...input,
    searchIntent,
    outline,
  });
  const seoReview = await reviewArticleSeo({
    ...input,
    searchIntent,
    outline,
    draft,
  });
  return assembleArticleDraft({
    input,
    searchIntent,
    outline,
    draft,
    seoReview,
  });
}

export function assembleArticleDraft(input: {
  input: ArticleDraftPipelineInput;
  searchIntent: SearchIntent;
  outline: ArticleOutline;
  draft: ArticleDraft;
  seoReview: SeoReview;
}) {
  const { draft, outline, searchIntent, seoReview } = input;
  const title = seoReview.finalTitle || draft.title;
  const metaTitle = seoReview.finalMetaTitle || draft.metaTitle;
  const metaDescription =
    seoReview.finalMetaDescription || draft.metaDescription;

  return {
    title,
    bodyMd: draft.bodyMd,
    metaTitle,
    metaDescription,
    aiConfidence: seoReview.aiConfidence,
    provenance: {
      generator: "ai-router-content-v1",
      generatedAt: new Date().toISOString(),
      briefVersion: input.input.brief.version,
      targetKeyword: input.input.asset.targetKeyword,
      searchIntent,
      outline,
      seoReview,
      schemaOrg: buildArticleSchema({
        title,
        metaDescription,
        productName: input.input.productName,
      }),
    },
  };
}

export async function researchSearcherIntent(input: ArticleDraftPipelineInput) {
  const prompt = [
    "Research the searcher intent for this target keyword using only the supplied product and Marketing Brief context.",
    "Return practical SEO planning information. Do not invent search volume or cite sources you cannot access.",
    "Return JSON only.",
    buildArticleInputBlock(input),
  ].join("\n\n");

  const result = await generateParsedJson({
    supabase: input.supabase,
    productId: input.asset.productId,
    userId: input.userId,
    taskClass: "seo_search_intent",
    system: buildArticleSystemPrompt(),
    prompt,
    maxOutputTokens: 1200,
    temperature: 0.2,
    responseJsonSchema: searchIntentJsonSchema,
    schema: searchIntentSchema,
    label: "search intent",
    metadata: {
      stage: "search_intent",
      contentAssetId: input.asset.id,
      targetKeyword: input.asset.targetKeyword,
    },
  });

  return result.data;
}

export async function generateArticleOutline(
  input: ArticleDraftPipelineInput & { searchIntent: SearchIntent },
) {
  const prompt = [
    "Create an SEO article outline for the target keyword.",
    "Use H2/H3 structure, include internal linking suggestions, and make the angle specific to the product.",
    "Return only JSON matching this shape:",
    "{ title: string; metaTitle: string; introHook: string; sections: Array<{ heading: string; points: string[] }>; internalLinkSuggestions: string[] }",
    buildArticleInputBlock(input),
    "Searcher intent:",
    JSON.stringify(input.searchIntent, null, 2),
  ].join("\n\n");

  const result = await generateParsedJson({
    supabase: input.supabase,
    productId: input.asset.productId,
    userId: input.userId,
    taskClass: "seo_article_outline",
    system: buildArticleSystemPrompt(),
    prompt,
    maxOutputTokens: 1800,
    temperature: 0.3,
    responseJsonSchema: outlineJsonSchema,
    schema: outlineSchema,
    label: "article outline",
    metadata: {
      stage: "article_outline",
      contentAssetId: input.asset.id,
      targetKeyword: input.asset.targetKeyword,
    },
  });

  return result.data;
}

export async function generateFullArticleDraft(
  input: ArticleDraftPipelineInput & {
    searchIntent: SearchIntent;
    outline: ArticleOutline;
  },
) {
  const prompt = [
    "Draft the full SEO article in Markdown.",
    "Target 1,800-2,400 words. Use the outline, answer the reader's practical questions, and keep claims grounded in the supplied brief.",
    "Include a strong intro, useful H2/H3 sections, concise examples, and a practical conclusion.",
    "Mention the product naturally where it helps, but do not make the article read like a sales page.",
    "Return only JSON matching this shape:",
    "{ title: string; metaTitle: string; metaDescription: string; bodyMd: string }",
    buildArticleInputBlock(input),
    "Searcher intent:",
    JSON.stringify(input.searchIntent, null, 2),
    "Approved outline:",
    JSON.stringify(input.outline, null, 2),
  ].join("\n\n");

  const result = await generateParsedJson({
    supabase: input.supabase,
    productId: input.asset.productId,
    userId: input.userId,
    taskClass: "seo_article_draft",
    system: buildArticleSystemPrompt(),
    prompt,
    maxOutputTokens: 6200,
    temperature: 0.45,
    responseJsonSchema: articleDraftJsonSchema,
    schema: articleDraftSchema,
    label: "article draft",
    metadata: {
      stage: "article_draft",
      contentAssetId: input.asset.id,
      targetKeyword: input.asset.targetKeyword,
    },
  });

  return result.data;
}

export async function reviewArticleSeo(
  input: ArticleDraftPipelineInput & {
    searchIntent: SearchIntent;
    outline: ArticleOutline;
    draft: ArticleDraft;
  },
) {
  const prompt = [
    "Review this article draft for SEO basics and metadata quality.",
    "Check that the target keyword appears in the title or close variant, the intro satisfies the intent, and the meta description is useful.",
    "Return JSON only. Do not rewrite the full article body.",
    buildArticleInputBlock(input),
    "Searcher intent:",
    JSON.stringify(input.searchIntent, null, 2),
    "Outline:",
    JSON.stringify(input.outline, null, 2),
    "Draft:",
    JSON.stringify(input.draft, null, 2),
  ].join("\n\n");

  const result = await generateParsedJson({
    supabase: input.supabase,
    productId: input.asset.productId,
    userId: input.userId,
    taskClass: "seo_review",
    system: buildArticleSystemPrompt(),
    prompt,
    maxOutputTokens: 1200,
    temperature: 0.15,
    responseJsonSchema: seoReviewJsonSchema,
    schema: seoReviewSchema,
    label: "SEO review",
    metadata: {
      stage: "seo_review",
      contentAssetId: input.asset.id,
      targetKeyword: input.asset.targetKeyword,
    },
  });

  return result.data;
}

function buildArticleSystemPrompt() {
  return buildLaunchBeaconSystemPrompt({
    extraInstructions:
      "You are a senior SEO content strategist for solo developers and small SaaS teams. Use plain language. Be specific. Avoid hype, filler, and unsupported claims. Output strict JSON when requested.",
  });
}

function buildArticleInputBlock(input: ArticleDraftPipelineInput) {
  return [
    "Product:",
    JSON.stringify(
      {
        name: input.productName,
      },
      null,
      2,
    ),
    "Content asset:",
    JSON.stringify(
      {
        title: input.asset.title,
        type: input.asset.type,
        targetKeyword: input.asset.targetKeyword,
        briefVersion: input.asset.briefVersion,
      },
      null,
      2,
    ),
    "Marketing Brief:",
    JSON.stringify(
      {
        tagline: input.brief.tagline,
        valueProps: input.brief.valueProps,
        personas: input.brief.personas,
        competitors: input.brief.competitors,
        keywordClusters: input.brief.keywordClusters,
        toneProfile: input.brief.toneProfile,
        channelsRanked: input.brief.channelsRanked,
        contentCalendarSeed: input.brief.contentCalendarSeed,
      },
      null,
      2,
    ),
  ].join("\n");
}

async function generateParsedJson<T>(input: {
  supabase: SupabaseClient;
  productId: string;
  userId?: string;
  taskClass:
    | "seo_search_intent"
    | "seo_article_outline"
    | "seo_article_draft"
    | "seo_review";
  system: string;
  prompt: string;
  maxOutputTokens: number;
  temperature: number;
  schema: z.ZodType<T>;
  responseJsonSchema: unknown;
  label: string;
  metadata: Record<string, unknown>;
}) {
  const result = await aiRouter.generateText({
    supabase: input.supabase,
    productId: input.productId,
    userId: input.userId,
    taskClass: input.taskClass,
    system: input.system,
    prompt: input.prompt,
    maxOutputTokens: input.maxOutputTokens,
    temperature: input.temperature,
    responseMimeType: "application/json",
    responseJsonSchema: input.responseJsonSchema,
    metadata: input.metadata,
  });

  try {
    return {
      data: parseJsonResult(result.text, input.schema, input.label),
      result,
    };
  } catch (error) {
    if (!(error instanceof ArticleAiParseError)) {
      throw error;
    }

    const retry = await aiRouter.generateText({
      supabase: input.supabase,
      productId: input.productId,
      userId: input.userId,
      taskClass: input.taskClass,
      system: input.system,
      prompt: [
        input.prompt,
        "The previous response was invalid JSON and could not be parsed.",
        "Return one complete JSON object only. Do not truncate strings. Do not include markdown.",
      ].join("\n\n"),
      maxOutputTokens: Math.ceil(input.maxOutputTokens * 1.5),
      temperature: 0.1,
      responseMimeType: "application/json",
      responseJsonSchema: input.responseJsonSchema,
      metadata: {
        ...input.metadata,
        retryReason: "invalid_json",
        previousParseError: error.message,
      },
    });

    return {
      data: parseJsonResult(retry.text, input.schema, input.label),
      result: retry,
    };
  }
}

function parseJsonResult<T>(
  text: string,
  schema: z.ZodType<T>,
  label: string,
): T {
  const parsed = safeJsonParse(extractJsonObject(text), label);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new ArticleAiParseError(
      `${label} response did not match the required schema: ${result.error.message}`,
    );
  }

  return result.data;
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

function safeJsonParse(value: string, label: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new ArticleAiParseError(
      `${label} response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function buildArticleSchema(input: {
  title: string;
  metaDescription: string;
  productName: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.metaDescription,
    author: {
      "@type": "Organization",
      name: input.productName,
    },
  };
}

export class ArticleAiParseError extends Error {
  constructor(message: string) {
    super(`Article AI output could not be parsed: ${message}`);
    this.name = "ArticleAiParseError";
  }
}

type SearchIntent = z.infer<typeof searchIntentSchema>;
type ArticleOutline = z.infer<typeof outlineSchema>;
type ArticleDraft = z.infer<typeof articleDraftSchema>;
type SeoReview = z.infer<typeof seoReviewSchema>;
