import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { aiRouter, buildLaunchBeaconSystemPrompt } from "@/server/ai";

export type InitialBriefInputs = {
  supabase: SupabaseClient;
  product: { id: string; name: string; url: string };
  crawl: {
    id: string;
    page_title: string | null;
    meta_description: string | null;
    h1: string | null;
    extracted_signals?: unknown;
  } | null;
  answers: Array<{ question_id: string; answer: string }>;
  nextVersion: number;
  userId?: string;
};

export type BriefPersonaAnalysis = z.infer<typeof briefPersonaAnalysisSchema>;
export type BriefKeywordAnalysis = z.infer<typeof briefKeywordAnalysisSchema>;

const personaAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    personas: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
    painPoints: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" } },
    jobsToBeDone: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
  },
  required: ["personas", "painPoints", "jobsToBeDone"],
};

const keywordAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    keywordClusters: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          intent: { type: "string", enum: ["informational", "commercial", "navigational"] },
          keywords: { type: "array", minItems: 3, maxItems: 8, items: { type: "string" } },
        },
        required: ["name", "intent", "keywords"],
      },
    },
  },
  required: ["keywordClusters"],
};

const finalBriefJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    tagline: { type: "string" },
    valueProps: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
    competitors: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
    toneProfile: {
      type: "object",
      additionalProperties: false,
      properties: {
        voice: { type: "string" },
        avoid: { type: "array", minItems: 3, maxItems: 8, items: { type: "string" } },
      },
      required: ["voice", "avoid"],
    },
    channelsRanked: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          channel: { type: "string" },
          rationale: { type: "string" },
        },
        required: ["channel", "rationale"],
      },
    },
    contentCalendarSeed: {
      type: "array",
      minItems: 5,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          format: { type: "string" },
          rationale: { type: "string" },
        },
        required: ["title", "format", "rationale"],
      },
    },
  },
  required: ["tagline", "valueProps", "competitors", "toneProfile", "channelsRanked", "contentCalendarSeed"],
};

const briefPersonaAnalysisSchema = z.object({
  personas: z.array(z.string().min(8)).min(2).max(3),
  painPoints: z.array(z.string().min(8)).min(3).max(6),
  jobsToBeDone: z.array(z.string().min(8)).min(2).max(5),
});

const briefKeywordAnalysisSchema = z.object({
  keywordClusters: z
    .array(
      z.object({
        name: z.string().min(3),
        intent: z.enum(["informational", "commercial", "navigational"]),
        keywords: z.array(z.string().min(2)).min(3).max(8),
      }),
    )
    .min(3)
    .max(6),
});

const finalBriefSchema = z.object({
  tagline: z.string().min(12).max(260),
  valueProps: z.array(z.string().min(8)).min(3).max(5),
  competitors: z.array(z.string().min(2)).min(2).max(6),
  toneProfile: z.object({
    voice: z.string().min(12).max(500),
    avoid: z.array(z.string().min(2)).min(3).max(8),
  }),
  channelsRanked: z
    .array(
      z.object({
        channel: z.string().min(2),
        rationale: z.string().min(12),
      }),
    )
    .min(3)
    .max(5),
  contentCalendarSeed: z
    .array(
      z.object({
        title: z.string().min(6),
        format: z.string().min(3),
        rationale: z.string().min(12),
      }),
    )
    .min(5)
    .max(8),
});

export async function generateBriefPersonaAnalysis(
  inputs: InitialBriefInputs,
): Promise<BriefPersonaAnalysis> {
  const prompt = [
    "Analyze this product and return 2-3 best-fit audience personas, pain points, and jobs-to-be-done.",
    "Do not say TBD, needs confirmation, unclear, or similar placeholder language. Make the strongest specific recommendation supported by the inputs.",
    "Return only JSON matching this TypeScript shape:",
    "{ personas: string[]; painPoints: string[]; jobsToBeDone: string[] }",
    buildBriefInputBlock(inputs),
  ].join("\n\n");

  const { data } = await generateParsedJson({
    supabase: inputs.supabase,
    productId: inputs.product.id,
    userId: inputs.userId,
    taskClass: "brief_persona_analysis",
    system: buildBriefSystemPrompt(),
    prompt,
    maxOutputTokens: 1400,
    temperature: 0.3,
    schema: briefPersonaAnalysisSchema,
    responseJsonSchema: personaAnalysisJsonSchema,
    label: "persona analysis",
    metadata: {
      stage: "persona_analysis",
      crawlResultId: inputs.crawl?.id ?? null,
    },
  });

  return data;
}

export async function generateBriefKeywordAnalysis(input: {
  inputs: InitialBriefInputs;
  personaAnalysis: BriefPersonaAnalysis;
}): Promise<BriefKeywordAnalysis> {
  const prompt = [
    "Generate keyword clusters by search intent for this product.",
    "Use clusters that can drive SEO content planning. Include informational, commercial, and navigational intent when appropriate.",
    "Return only JSON matching this TypeScript shape:",
    "{ keywordClusters: Array<{ name: string; intent: 'informational' | 'commercial' | 'navigational'; keywords: string[] }> }",
    buildBriefInputBlock(input.inputs),
    "Persona analysis:",
    JSON.stringify(input.personaAnalysis, null, 2),
  ].join("\n\n");

  const { data } = await generateParsedJson({
    supabase: input.inputs.supabase,
    productId: input.inputs.product.id,
    userId: input.inputs.userId,
    taskClass: "brief_keyword_analysis",
    system: buildBriefSystemPrompt(),
    prompt,
    maxOutputTokens: 1000,
    temperature: 0.25,
    schema: briefKeywordAnalysisSchema,
    responseJsonSchema: keywordAnalysisJsonSchema,
    label: "keyword analysis",
    metadata: {
      stage: "keyword_analysis",
      crawlResultId: input.inputs.crawl?.id ?? null,
    },
  });

  return data;
}

export async function synthesizeInitialBrief(input: {
  inputs: InitialBriefInputs;
  personaAnalysis: BriefPersonaAnalysis;
  keywordAnalysis: BriefKeywordAnalysis;
}) {
  const prompt = [
    "Create the final LaunchBeacon Marketing Brief for this product.",
    "Be a marketing strategist for solo developers. Use plain language, concrete recommendations, and no jargon.",
    "Never use TBD, needs confirmation, placeholder language, or internal uncertainty notes.",
    "Return only JSON matching this TypeScript shape:",
    "{ tagline: string; valueProps: string[]; competitors: string[]; toneProfile: { voice: string; avoid: string[] }; channelsRanked: Array<{ channel: string; rationale: string }>; contentCalendarSeed: Array<{ title: string; format: string; rationale: string }> }",
    buildBriefInputBlock(input.inputs),
    "Persona analysis:",
    JSON.stringify(input.personaAnalysis, null, 2),
    "Keyword analysis:",
    JSON.stringify(input.keywordAnalysis, null, 2),
  ].join("\n\n");

  const { data: finalBrief, result } = await generateParsedJson({
    supabase: input.inputs.supabase,
    productId: input.inputs.product.id,
    userId: input.inputs.userId,
    taskClass: "brief_generation",
    system: buildBriefSystemPrompt(),
    prompt,
    maxOutputTokens: 2600,
    temperature: 0.35,
    schema: finalBriefSchema,
    responseJsonSchema: finalBriefJsonSchema,
    label: "brief synthesis",
    metadata: {
      stage: "brief_synthesis",
      crawlResultId: input.inputs.crawl?.id ?? null,
    },
  });

  return {
    version: input.inputs.nextVersion,
    tagline: finalBrief.tagline,
    valueProps: finalBrief.valueProps,
    personas: input.personaAnalysis.personas,
    competitors: finalBrief.competitors,
    keywordClusters: input.keywordAnalysis.keywordClusters.map((cluster) => ({
      name: `${cluster.name} (${cluster.intent})`,
      keywords: cluster.keywords,
    })),
    toneProfile: finalBrief.toneProfile,
    channelsRanked: finalBrief.channelsRanked,
    contentCalendarSeed: finalBrief.contentCalendarSeed,
    provenance: {
      generator: "ai-router-v1",
      modelProvider: result.provider,
      model: result.model,
      usageEventId: result.usageEventId,
      productId: input.inputs.product.id,
      crawlResultId: input.inputs.crawl?.id ?? null,
      interviewAnswerCount: input.inputs.answers.length,
      generatedAt: new Date().toISOString(),
      stages: {
        personaAnalysis: input.personaAnalysis,
        keywordAnalysis: input.keywordAnalysis,
      },
    },
  };
}

export async function buildInitialBrief(inputs: InitialBriefInputs) {
  const personaAnalysis = await generateBriefPersonaAnalysis(inputs);
  const keywordAnalysis = await generateBriefKeywordAnalysis({
    inputs,
    personaAnalysis,
  });

  return synthesizeInitialBrief({
    inputs,
    personaAnalysis,
    keywordAnalysis,
  });
}

function buildBriefSystemPrompt() {
  return buildLaunchBeaconSystemPrompt({
    extraInstructions:
      "Output strict JSON only. Do not wrap JSON in markdown. Do not include comments.",
  });
}

function buildBriefInputBlock(inputs: InitialBriefInputs) {
  const answers = Object.fromEntries(
    inputs.answers.map((answer) => [answer.question_id, answer.answer.trim()]),
  );

  return [
    "Product:",
    JSON.stringify(
      {
        name: inputs.product.name,
        url: inputs.product.url,
      },
      null,
      2,
    ),
    "Latest crawl result:",
    JSON.stringify(
      {
        pageTitle: inputs.crawl?.page_title ?? null,
        metaDescription: inputs.crawl?.meta_description ?? null,
        h1: inputs.crawl?.h1 ?? null,
        extractedSignals: inputs.crawl?.extracted_signals ?? null,
      },
      null,
      2,
    ),
    "Interview answers:",
    JSON.stringify(answers, null, 2),
  ].join("\n");
}

async function generateParsedJson<T>(input: {
  supabase: SupabaseClient;
  productId: string;
  userId?: string;
  taskClass: "brief_persona_analysis" | "brief_keyword_analysis" | "brief_generation";
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
    if (!(error instanceof BriefAiParseError)) {
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
  const parsed = safeJsonParse(extractJsonObject(text));
  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new BriefAiParseError(
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

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new BriefAiParseError(
      `AI response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export class BriefAiParseError extends Error {
  constructor(message: string) {
    super(`Marketing Brief AI output could not be parsed: ${message}`);
    this.name = "BriefAiParseError";
  }
}
