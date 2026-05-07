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
  jobToBeDone: z.string().min(20),
  serpArchetype: z.enum([
    "definition_explainer",
    "how_to_tutorial",
    "comparison_listicle",
    "tool_recommendation",
    "case_study",
    "reference_doc",
    "troubleshooting",
  ]),
  readerProblems: z.array(z.string().min(6)).min(3).max(6),
  questionsToAnswer: z.array(z.string().min(6)).min(4).max(10),
  mustCover: z.array(z.string().min(6)).min(4).max(10),
  mustAvoid: z.array(z.string().min(6)).min(2).max(6),
  contentAngle: z.string().min(12),
  differentiationHook: z.string().min(20),
});

const outlineSchema = z.object({
  title: z.string().min(10).max(120),
  metaTitle: z.string().min(10).max(120),
  editorialBrief: z.string().min(20).max(2000),
  sections: z
    .array(
      z.object({
        heading: z.string().min(6).max(120),
        points: z.array(z.string().min(6)).min(2).max(6),
      }),
    )
    .min(5)
    .max(10),
  internalLinkSuggestions: z.array(z.string().min(4)).max(8),
});

const articleDraftSchema = z.object({
  title: z.string().min(10).max(180),
  metaTitle: z.string().min(10).max(140),
  metaDescription: z.string().min(80).max(500),
  bodyMd: z.string().min(2500).max(60000),
});

const seoReviewSchema = z.object({
  titleIncludesKeyword: z.boolean(),
  introAddressesIntent: z.boolean(),
  outlineFollowed: z.boolean(),
  containsForbiddenPhrases: z.array(z.string()).max(12),
  containsUnsupportedClaims: z.array(z.string()).max(12),
  passes: z.boolean(),
  finalTitle: z.string().min(10).max(180),
  finalMetaTitle: z.string().min(10).max(140),
  finalMetaDescription: z.string().min(80).max(500),
  revisionsNeeded: z.array(z.string()).max(8),
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
    jobToBeDone: { type: "string" },
    serpArchetype: {
      type: "string",
      enum: [
        "definition_explainer",
        "how_to_tutorial",
        "comparison_listicle",
        "tool_recommendation",
        "case_study",
        "reference_doc",
        "troubleshooting",
      ],
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
    mustAvoid: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: { type: "string" },
    },
    contentAngle: { type: "string" },
    differentiationHook: { type: "string" },
  },
  required: [
    "primaryIntent",
    "searchStage",
    "jobToBeDone",
    "serpArchetype",
    "readerProblems",
    "questionsToAnswer",
    "mustCover",
    "mustAvoid",
    "contentAngle",
    "differentiationHook",
  ],
};

const seoReviewJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    titleIncludesKeyword: { type: "boolean" },
    introAddressesIntent: { type: "boolean" },
    outlineFollowed: { type: "boolean" },
    containsForbiddenPhrases: {
      type: "array",
      maxItems: 12,
      items: { type: "string" },
    },
    containsUnsupportedClaims: {
      type: "array",
      maxItems: 12,
      items: { type: "string" },
    },
    passes: { type: "boolean" },
    finalTitle: { type: "string" },
    finalMetaTitle: { type: "string" },
    finalMetaDescription: { type: "string" },
    revisionsNeeded: { type: "array", maxItems: 8, items: { type: "string" } },
  },
  required: [
    "titleIncludesKeyword",
    "introAddressesIntent",
    "outlineFollowed",
    "containsForbiddenPhrases",
    "containsUnsupportedClaims",
    "passes",
    "finalTitle",
    "finalMetaTitle",
    "finalMetaDescription",
    "revisionsNeeded",
  ],
};

const outlineJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    metaTitle: { type: "string" },
    editorialBrief: { type: "string" },
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
      maxItems: 8,
      items: { type: "string" },
    },
  },
  required: [
    "title",
    "metaTitle",
    "editorialBrief",
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
  const title = clampText(seoReview.finalTitle || draft.title, 180);
  const metaTitle = clampText(seoReview.finalMetaTitle || draft.metaTitle, 120);
  const metaDescription =
    clampText(seoReview.finalMetaDescription || draft.metaDescription, 300);

  return {
    title,
    bodyMd: draft.bodyMd,
    metaTitle,
    metaDescription,
    aiConfidence: scoreSeoReview(seoReview),
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
    "Infer the searcher intent for this target keyword using the supplied product and Marketing Brief context.",
    "You cannot access the live SERP. Use pattern recognition: what archetype of content usually ranks for queries shaped like this?",
    "The jobToBeDone field must describe what the searcher is trying to accomplish, not just what topic they typed.",
    "The differentiationHook must propose a specific angle a competitor article would not take, grounded in the product's actual position from the brief.",
    "The mustAvoid list should name generic tropes or sections that competing articles commonly include but that add little value.",
    "Do not invent search volume or cite sources you cannot access.",
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
    "Use H2 structure, include internal linking suggestions as anchor text or topic ideas only, and make the angle specific to the product.",
    "The editorialBrief field is guidance for the writer. It is not article copy and must not be quoted by the draft stage.",
    "Internal link suggestions must not invent URLs. Suggest anchor text and target topic only unless a known URL is supplied.",
    "Return only JSON matching this shape:",
    "{ title: string; metaTitle: string; editorialBrief: string; sections: Array<{ heading: string; points: string[] }>; internalLinkSuggestions: string[] }",
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
    temperature: 0.5,
    responseJsonSchema: outlineJsonSchema,
    schema: outlineSchema,
    normalize: (value) =>
      normalizeArticleOutline({
        value,
        searchIntent: input.searchIntent,
        title: input.asset.title,
        targetKeyword: input.asset.targetKeyword,
      }),
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
    "STRUCTURAL CONTRACT:",
    "- Use every H2 heading from the outline, in order, with the exact wording.",
    "- Do not add H2 sections not in the outline. You may add H3 subsections within them.",
    "- Length is determined by the searcher intent, not a target word count. Stop when the intent is satisfied.",
    "",
    "INTRO:",
    "- First sentence states the specific problem or question, not the topic in general.",
    "- No throat-clearing. The reader knows what they searched for.",
    "- Within the first 100 words, state what this article gives them that generic SERP results do not.",
    "",
    "BODY:",
    "- Every claim must be either verifiable from the brief, common knowledge in the domain, or clearly framed as opinion.",
    "- Use code blocks, tables, or numbered steps where they reduce ambiguity. Do not use them for decoration.",
    "- Mention the product where genuinely relevant. If the mention feels forced, omit it.",
    "",
    "CONCLUSION:",
    "- Either give the reader the next concrete step, or omit the conclusion entirely.",
    "- Do not summarize what the article said.",
    "Return only JSON matching this shape:",
    "{ title: string; metaTitle: string; metaDescription: string; bodyMd: string }",
    buildArticleInputBlock(input),
    "Searcher intent:",
    JSON.stringify(input.searchIntent, null, 2),
    "Approved outline (follow the section structure exactly):",
    JSON.stringify(buildDraftOutline(input.outline), null, 2),
  ].join("\n\n");

  const result = await generateParsedJson({
    supabase: input.supabase,
    productId: input.asset.productId,
    userId: input.userId,
    taskClass: "seo_article_draft",
    system: buildArticleSystemPrompt(),
    prompt,
    maxOutputTokens: 6200,
    temperature: 0.6,
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
    "Review this article draft for SEO basics and editorial quality.",
    "This is a review pass, not a rewrite pass. Return concrete pass/fail criteria and improved metadata only.",
    "Set passes=false if the title misses the target keyword or close variant, the intro does not answer the inferred intent, the outline was not followed, forbidden AI-style phrases appear, or unsupported claims are present.",
    "Forbidden phrases include: In today's, In the world of, When it comes to, It's important to note, It's worth mentioning, Let's dive in, That said, At the end of the day, seamless, powerful, robust, revolutionize, unlock, leverage, cutting-edge, game-changer.",
    "revisionsNeeded must be actionable. Do not write vague notes such as 'make it better' or 'improve specificity'.",
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
    extraInstructions: [
      "You are an SEO content writer for solo-developer and small SaaS teams.",
      "",
      "VOICE:",
      "- Direct, technical, specific. Write like a senior engineer explaining to a peer.",
      "- First person plural ('we') is allowed when describing the product's perspective.",
      "- No marketing voice. No hype words: seamless, powerful, robust, revolutionize, unlock, leverage, cutting-edge, game-changer.",
      "",
      "FORBIDDEN PATTERNS:",
      "- Opening with 'In today's...', 'In the world of...', or 'When it comes to...'.",
      "- Phrases: 'It's important to note', 'It's worth mentioning', 'Let's dive in', 'That said', 'At the end of the day'.",
      "- Tricolon openers.",
      "- 'Whether you're X or Y' constructions.",
      "- Conclusion paragraphs that restate the introduction.",
      "- Empty transitional sentences.",
      "- Bulleted lists where the bullets are full sentences with no parallel structure.",
      "",
      "REQUIRED:",
      "- Specifics over generics: name versions, numbers, libraries, tradeoffs, and operational details when they are known.",
      "- If you cannot be specific about a claim, omit the claim.",
      "- Every section must add information not present in the previous section.",
      "",
      "Output strict JSON when requested. No markdown fences around JSON.",
    ].join("\n"),
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

function buildDraftOutline(outline: ArticleOutline) {
  return {
    title: outline.title,
    metaTitle: outline.metaTitle,
    sections: outline.sections,
    internalLinkSuggestions: outline.internalLinkSuggestions,
  };
}

function scoreSeoReview(review: SeoReview) {
  const failedCriteria = [
    !review.titleIncludesKeyword,
    !review.introAddressesIntent,
    !review.outlineFollowed,
    review.containsForbiddenPhrases.length > 0,
    review.containsUnsupportedClaims.length > 0,
    !review.passes,
  ].filter(Boolean).length;

  return Math.max(0.45, Math.min(0.95, 0.95 - failedCriteria * 0.08));
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
  normalize?: (value: unknown) => unknown;
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
      data: parseJsonResult(result.text, input.schema, input.label, input.normalize),
      result,
    };
  } catch (error) {
    if (!(error instanceof ArticleAiParseError) || error.kind !== "json") {
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
      data: parseJsonResult(retry.text, input.schema, input.label, input.normalize),
      result: retry,
    };
  }
}

function parseJsonResult<T>(
  text: string,
  schema: z.ZodType<T>,
  label: string,
  normalize?: (value: unknown) => unknown,
): T {
  const parsed = normalize
    ? normalize(safeJsonParse(extractJsonObject(text), label))
    : safeJsonParse(extractJsonObject(text), label);
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

function normalizeArticleOutline(input: {
  value: unknown;
  searchIntent: SearchIntent;
  title: string;
  targetKeyword: string | null;
}) {
  if (!input.value || typeof input.value !== "object" || Array.isArray(input.value)) {
    return input.value;
  }

  const value = input.value as Record<string, unknown>;
  const sections = Array.isArray(value.sections) && value.sections.length > 0
    ? value.sections
    : buildFallbackOutlineSections(input.searchIntent, input.targetKeyword ?? input.title);

  return {
    ...value,
    title: typeof value.title === "string" ? value.title : input.title,
    metaTitle: typeof value.metaTitle === "string" ? value.metaTitle : input.title,
    editorialBrief:
      typeof value.editorialBrief === "string"
        ? value.editorialBrief
        : typeof value.introHook === "string"
          ? value.introHook
          : input.searchIntent.differentiationHook,
    sections,
    internalLinkSuggestions: Array.isArray(value.internalLinkSuggestions)
      ? value.internalLinkSuggestions
      : [],
  };
}

function buildFallbackOutlineSections(searchIntent: SearchIntent, topic: string) {
  const points = [
    ...searchIntent.mustCover,
    ...searchIntent.questionsToAnswer,
    ...searchIntent.readerProblems,
  ].filter(Boolean);
  const fallbackPoints = points.length >= 10 ? points : [
    ...points,
    searchIntent.jobToBeDone,
    searchIntent.contentAngle,
    searchIntent.differentiationHook,
  ];
  const headings = [
    `What ${topic} needs to solve`,
    "The practical workflow",
    "Checks before you choose an approach",
    "Where the product fits",
    "Next step",
  ];

  return headings.map((heading, index) => ({
    heading,
    points: [
      fallbackPoints[index * 2] ?? searchIntent.primaryIntent,
      fallbackPoints[index * 2 + 1] ?? searchIntent.differentiationHook,
    ],
  }));
}

function safeJsonParse(value: string, label: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new ArticleAiParseError(
      `${label} response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      "json",
    );
  }
}

function clampText(value: string, maxLength: number) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength - 1).trimEnd() + ".";
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
  constructor(message: string, readonly kind: "json" | "schema" = "schema") {
    super(`Article AI output could not be parsed: ${message}`);
    this.name = "ArticleAiParseError";
  }
}

type SearchIntent = z.infer<typeof searchIntentSchema>;
type ArticleOutline = z.infer<typeof outlineSchema>;
type ArticleDraft = z.infer<typeof articleDraftSchema>;
type SeoReview = z.infer<typeof seoReviewSchema>;
