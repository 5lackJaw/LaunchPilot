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
  primaryIntent: z.string().min(8).max(220),
  searchStage: z.enum([
    "awareness",
    "consideration",
    "decision",
    "navigational",
  ]),
  jobToBeDone: z.string().min(20).max(260),
  serpArchetype: z.enum([
    "definition_explainer",
    "how_to_tutorial",
    "comparison_listicle",
    "tool_recommendation",
    "case_study",
    "reference_doc",
    "troubleshooting",
  ]),
  readerProblems: z.array(z.string().min(6).max(180)).min(3).max(6),
  questionsToAnswer: z.array(z.string().min(6).max(180)).min(4).max(10),
  mustCover: z.array(z.string().min(6).max(180)).min(4).max(10),
  mustAvoid: z.array(z.string().min(6).max(180)).min(2).max(6),
  contentAngle: z.string().min(12).max(260),
  differentiationHook: z.string().min(20).max(260),
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
    primaryIntent: { type: "string", maxLength: 220 },
    searchStage: {
      type: "string",
      enum: ["awareness", "consideration", "decision", "navigational"],
    },
    jobToBeDone: { type: "string", maxLength: 260 },
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
      items: { type: "string", maxLength: 180 },
    },
    questionsToAnswer: {
      type: "array",
      minItems: 4,
      maxItems: 10,
      items: { type: "string", maxLength: 180 },
    },
    mustCover: {
      type: "array",
      minItems: 4,
      maxItems: 10,
      items: { type: "string", maxLength: 180 },
    },
    mustAvoid: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: { type: "string", maxLength: 180 },
    },
    contentAngle: { type: "string", maxLength: 260 },
    differentiationHook: { type: "string", maxLength: 260 },
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
    "Keep all strings concise: no field over 260 characters, no array item over 180 characters.",
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
    maxOutputTokens: 2400,
    temperature: 0.2,
    responseJsonSchema: searchIntentJsonSchema,
    schema: searchIntentSchema,
    label: "search intent",
    maxJsonRetries: 2,
    retryMaxOutputTokens: 3600,
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
  return seoReviewSchema.parse(
    buildDeterministicSeoReview({
      searchIntent: input.searchIntent,
      outline: input.outline,
      draft: input.draft,
      targetKeyword: input.asset.targetKeyword ?? input.asset.title,
    }),
  );
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

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesKeywordVariant(text: string, keyword: string) {
  const haystack = normalizeKeyword(text);
  const needle = normalizeKeyword(keyword);
  return haystack.includes(needle) || needle.split(" ").some((part) => part.length > 4 && haystack.includes(part));
}

function extractIntroText(bodyMd: string) {
  const withoutHeadings = bodyMd.replace(/^#{1,6}\s+.*$/gm, "");
  return withoutHeadings.trim().slice(0, 900);
}

function introMentionsIntent(intro: string, searchIntent: SearchIntent, targetKeyword: string) {
  const text = normalizeKeyword(intro);
  const signals = [
    targetKeyword,
    searchIntent.primaryIntent,
    searchIntent.jobToBeDone,
    searchIntent.contentAngle,
  ].map(normalizeKeyword);

  return signals.some((signal) => signal.length > 4 && text.includes(signal));
}

function findForbiddenPhrases(text: string) {
  const patterns = [
    /in today'?s/gi,
    /in the world of/gi,
    /when it comes to/gi,
    /it'?s important to note/gi,
    /it'?s worth mentioning/gi,
    /let'?s dive in/gi,
    /that said/gi,
    /at the end of the day/gi,
    /seamless/gi,
    /powerful/gi,
    /robust/gi,
    /revolutionize/gi,
    /unlock/gi,
    /leverage/gi,
    /cutting-edge/gi,
    /game-changer/gi,
  ];

  return matchPatterns(text, patterns);
}

function findUnsupportedClaims(text: string) {
  const patterns = [
    /guaranteed/gi,
    /always/gi,
    /never/gi,
    /proven/gi,
    /best-in-class/gi,
    /world-class/gi,
    /industry-leading/gi,
    /future-proof/gi,
  ];

  return matchPatterns(text, patterns);
}

function matchPatterns(text: string, patterns: RegExp[]) {
  const matches = new Set<string>();

  for (const pattern of patterns) {
    const found = text.match(pattern);
    if (!found) {
      continue;
    }

    for (const item of found) {
      matches.add(item.toLowerCase());
    }
  }

  return Array.from(matches);
}

function chooseFinalTitle(title: string, targetKeyword: string, includesKeyword: boolean) {
  if (includesKeyword) {
    return clampText(title, 180);
  }

  const prefix = targetKeyword || "";
  if (!prefix) {
    return clampText(title, 180);
  }

  return clampText(`${prefix}: ${title}`, 180);
}

function buildDeterministicSeoReview(input: {
  searchIntent: SearchIntent;
  outline: ArticleOutline;
  draft: ArticleDraft;
  targetKeyword: string;
}): SeoReview {
  const forbiddenPhrases = findForbiddenPhrases(
    [input.draft.title, input.draft.metaTitle, input.draft.metaDescription, input.draft.bodyMd].join("\n"),
  );
  const unsupportedClaims = findUnsupportedClaims(
    [input.draft.title, input.draft.metaTitle, input.draft.metaDescription, input.draft.bodyMd].join("\n"),
  );
  const targetKeyword = normalizeKeyword(input.targetKeyword);
  const titleIncludesKeyword = includesKeywordVariant(input.draft.title, targetKeyword);
  const intro = extractIntroText(input.draft.bodyMd);
  const introAddressesIntent = introMentionsIntent(intro, input.searchIntent, targetKeyword);
  const outlineFollowed = input.outline.sections.every((section) =>
    input.draft.bodyMd.includes(`## ${section.heading}`) ||
    input.draft.bodyMd.includes(`### ${section.heading}`),
  );
  const revisionsNeeded: string[] = [];

  if (!titleIncludesKeyword) {
    revisionsNeeded.push("Include the target keyword or a close variant in the title.");
  }

  if (!introAddressesIntent) {
    revisionsNeeded.push("Rewrite the opening paragraph so it answers the search intent immediately.");
  }

  if (!outlineFollowed) {
    revisionsNeeded.push("Keep the article aligned to the outline headings and do not add missing H2 sections.");
  }

  if (forbiddenPhrases.length > 0) {
    revisionsNeeded.push(`Remove AI-slop phrasing such as: ${forbiddenPhrases.slice(0, 3).join(", ")}.`);
  }

  if (unsupportedClaims.length > 0) {
    revisionsNeeded.push(`Remove unsupported claims such as: ${unsupportedClaims.slice(0, 3).join(", ")}.`);
  }

  return {
    titleIncludesKeyword,
    introAddressesIntent,
    outlineFollowed,
    containsForbiddenPhrases: forbiddenPhrases,
    containsUnsupportedClaims: unsupportedClaims,
    passes:
      titleIncludesKeyword &&
      introAddressesIntent &&
      outlineFollowed &&
      forbiddenPhrases.length === 0 &&
      unsupportedClaims.length === 0,
    finalTitle: chooseFinalTitle(input.draft.title, targetKeyword, titleIncludesKeyword),
    finalMetaTitle: clampText(input.draft.metaTitle, 120),
    finalMetaDescription: clampText(input.draft.metaDescription, 170),
    revisionsNeeded: revisionsNeeded.slice(0, 8),
  };
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
  maxJsonRetries?: number;
  retryMaxOutputTokens?: number;
  metadata: Record<string, unknown>;
}) {
  const maxAttempts = 1 + (input.maxJsonRetries ?? 1);
  let previousParseError: ArticleAiParseError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const isRetry = attempt > 0;
    const result = await aiRouter.generateText({
      supabase: input.supabase,
      productId: input.productId,
      userId: input.userId,
      taskClass: input.taskClass,
      system: input.system,
      prompt: isRetry
        ? [
            input.prompt,
            "The previous response was invalid or truncated JSON and could not be parsed.",
            "Return one complete JSON object only. Close every string and array. Do not include markdown.",
            previousParseError ? `Parser error: ${previousParseError.message}` : "",
          ].filter(Boolean).join("\n\n")
        : input.prompt,
      maxOutputTokens: isRetry
        ? (input.retryMaxOutputTokens ?? Math.ceil(input.maxOutputTokens * 1.75))
        : input.maxOutputTokens,
      temperature: isRetry ? 0.1 : input.temperature,
      responseMimeType: "application/json",
      responseJsonSchema: input.responseJsonSchema,
      metadata: isRetry
        ? {
            ...input.metadata,
            retryReason: "invalid_or_truncated_json",
            retryAttempt: attempt,
            previousParseError: previousParseError?.message,
          }
        : input.metadata,
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

      previousParseError = error;

      if (attempt === maxAttempts - 1) {
        throw error;
      }
    }
  }

  throw previousParseError ?? new ArticleAiParseError(`${input.label} response was not valid JSON.`, "json");
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
