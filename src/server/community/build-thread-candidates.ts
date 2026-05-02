import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { aiRouter, buildLaunchBeaconSystemPrompt } from "@/server/ai";
import type { MarketingBrief } from "@/server/schemas/brief";

export type CommunityThreadCandidate = {
  platform: string;
  threadUrl: string;
  threadTitle: string;
  threadAuthorHandle: string;
  relevanceScore: number;
  painSignalScore: number;
  audienceFitScore: number;
  recencyScore: number;
  provenance: Record<string, unknown>;
};

type RawThreadCandidate = {
  id: string;
  platform: "reddit" | "hacker_news";
  threadUrl: string;
  threadTitle: string;
  threadAuthorHandle: string;
  bodySnippet: string;
  keyword: string;
  createdAt: string | null;
  sourceScore: number;
};

const relevanceThreshold = 65;
const maxCandidatesToScore = 30;
const maxPersistedThreads = 12;

const threadScoreSchema = z.object({
  scores: z
    .array(
      z.object({
        id: z.string(),
        relevanceScore: z.number().min(0).max(100),
        painSignalScore: z.number().min(0).max(100),
        audienceFitScore: z.number().min(0).max(100),
        recencyScore: z.number().min(0).max(100),
        rationale: z.string().max(500),
      }),
    )
    .max(maxCandidatesToScore),
});

const threadScoreJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    scores: {
      type: "array",
      maxItems: maxCandidatesToScore,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          relevanceScore: { type: "number" },
          painSignalScore: { type: "number" },
          audienceFitScore: { type: "number" },
          recencyScore: { type: "number" },
          rationale: { type: "string" },
        },
        required: [
          "id",
          "relevanceScore",
          "painSignalScore",
          "audienceFitScore",
          "recencyScore",
          "rationale",
        ],
      },
    },
  },
  required: ["scores"],
};

export async function buildThreadCandidates(input: {
  supabase: SupabaseClient;
  productId: string;
  userId?: string;
  productName: string;
  brief: MarketingBrief;
}): Promise<CommunityThreadCandidate[]> {
  const keywords = selectScanKeywords(input);
  const rawCandidates = dedupeRawCandidates(
    (
      await Promise.all(
        keywords.map((keyword) => fetchCandidatesForKeyword(keyword)),
      )
    ).flat(),
  )
    .sort((a, b) => b.sourceScore - a.sourceScore)
    .slice(0, maxCandidatesToScore);

  if (!rawCandidates.length) {
    return [];
  }

  const scores = await scoreThreadCandidates({
    supabase: input.supabase,
    productId: input.productId,
    userId: input.userId,
    productName: input.productName,
    brief: input.brief,
    candidates: rawCandidates,
  });
  const scoreById = new Map(scores.scores.map((score) => [score.id, score]));

  const scoredCandidates: CommunityThreadCandidate[] = [];

  for (const candidate of rawCandidates) {
    const score = scoreById.get(candidate.id);
    if (!score || score.relevanceScore < relevanceThreshold) {
      continue;
    }

    scoredCandidates.push({
      platform: candidate.platform,
      threadUrl: candidate.threadUrl,
      threadTitle: candidate.threadTitle,
      threadAuthorHandle: candidate.threadAuthorHandle,
      relevanceScore: normalizeScore(score.relevanceScore),
      painSignalScore: normalizeScore(score.painSignalScore),
      audienceFitScore: normalizeScore(score.audienceFitScore),
      recencyScore: normalizeScore(score.recencyScore),
      provenance: {
        source: "public-community-search-v1",
        scoring: "ai-router-community-thread-scoring-v1",
        keyword: candidate.keyword,
        bodySnippet: candidate.bodySnippet,
        createdAt: candidate.createdAt,
        sourceScore: candidate.sourceScore,
        rationale: score.rationale,
        threshold: relevanceThreshold,
        scoredAt: new Date().toISOString(),
      },
    });
  }

  return scoredCandidates
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxPersistedThreads);
}

async function fetchCandidatesForKeyword(keyword: string) {
  const [reddit, hackerNews] = await Promise.allSettled([
    fetchRedditCandidates(keyword),
    fetchHackerNewsCandidates(keyword),
  ]);

  return [
    ...(reddit.status === "fulfilled" ? reddit.value : []),
    ...(hackerNews.status === "fulfilled" ? hackerNews.value : []),
  ];
}

async function fetchRedditCandidates(
  keyword: string,
): Promise<RawThreadCandidate[]> {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=new&limit=25`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "LaunchBeaconBot/0.1 community research",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    return [];
  }

  const payload = redditSearchResponseSchema.safeParse(await response.json());
  if (!payload.success) {
    return [];
  }

  return payload.data.data.children
    .map((child) => child.data)
    .filter((item) => Boolean(item.title && item.permalink))
    .map((item) => ({
      id: `reddit:${item.id}`,
      platform: "reddit" as const,
      threadUrl: `https://www.reddit.com${item.permalink}`,
      threadTitle: cleanText(item.title ?? ""),
      threadAuthorHandle: item.author ? `u/${item.author}` : "unknown",
      bodySnippet: cleanText(item.selftext ?? "").slice(0, 600),
      keyword,
      createdAt: item.created_utc
        ? new Date(item.created_utc * 1000).toISOString()
        : null,
      sourceScore: Number(item.score ?? 0) + Number(item.num_comments ?? 0) * 2,
    }));
}

async function fetchHackerNewsCandidates(
  keyword: string,
): Promise<RawThreadCandidate[]> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(keyword)}&tags=story`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    return [];
  }

  const payload = hnSearchResponseSchema.safeParse(await response.json());
  if (!payload.success) {
    return [];
  }

  return payload.data.hits
    .filter((item) => Boolean(item.objectID && item.title))
    .slice(0, 25)
    .map((item) => ({
      id: `hn:${item.objectID}`,
      platform: "hacker_news" as const,
      threadUrl: `https://news.ycombinator.com/item?id=${item.objectID}`,
      threadTitle: cleanText(item.title ?? ""),
      threadAuthorHandle: item.author ?? "unknown",
      bodySnippet: cleanText(item.story_text ?? ""),
      keyword,
      createdAt: item.created_at ?? null,
      sourceScore:
        Number(item.points ?? 0) + Number(item.num_comments ?? 0) * 2,
    }));
}

async function scoreThreadCandidates(input: {
  supabase: SupabaseClient;
  productId: string;
  userId?: string;
  productName: string;
  brief: MarketingBrief;
  candidates: RawThreadCandidate[];
}) {
  const result = await aiRouter.generateText({
    supabase: input.supabase,
    productId: input.productId,
    userId: input.userId,
    taskClass: "community_thread_scoring",
    system: buildLaunchBeaconSystemPrompt({
      extraInstructions:
        "You score public community threads for helpful, non-spammy participation. Be selective. Favor clear pain, audience fit, and recent practical discussions. Return strict JSON only.",
    }),
    prompt: [
      "Score each candidate from 0 to 100.",
      "relevanceScore: overall fit for helpful participation by this product.",
      "painSignalScore: how clearly the thread expresses a pain/problem the product can help with.",
      "audienceFitScore: how closely participants match the Marketing Brief personas.",
      "recencyScore: recent and still worth responding to.",
      `Only candidates scoring above ${relevanceThreshold} will be surfaced, so do not inflate weak matches.`,
      "Product context:",
      JSON.stringify(
        {
          productName: input.productName,
          tagline: input.brief.tagline,
          valueProps: input.brief.valueProps,
          personas: input.brief.personas,
          toneProfile: input.brief.toneProfile,
          keywordClusters: input.brief.keywordClusters,
        },
        null,
        2,
      ),
      "Candidates:",
      JSON.stringify(
        input.candidates.map((candidate) => ({
          id: candidate.id,
          platform: candidate.platform,
          title: candidate.threadTitle,
          author: candidate.threadAuthorHandle,
          bodySnippet: candidate.bodySnippet,
          keyword: candidate.keyword,
          createdAt: candidate.createdAt,
        })),
        null,
        2,
      ),
      "Return JSON with a scores array. Include every candidate id exactly once.",
    ].join("\n\n"),
    maxOutputTokens: 3600,
    temperature: 0.15,
    responseMimeType: "application/json",
    responseJsonSchema: threadScoreJsonSchema,
    metadata: {
      candidateCount: input.candidates.length,
      stage: "community_thread_scoring",
    },
  });

  return parseJsonResult(
    result.text,
    threadScoreSchema,
    "community thread scores",
  );
}

function selectScanKeywords(input: {
  productName: string;
  brief: MarketingBrief;
}) {
  const clusterKeywords = input.brief.keywordClusters
    .flatMap((cluster) => cluster.keywords.slice(0, 3))
    .map(cleanText)
    .filter(Boolean);
  const seedKeywords = input.brief.contentCalendarSeed
    .map((seed) => cleanText(seed.title))
    .filter(Boolean);

  return dedupeStrings([...clusterKeywords, ...seedKeywords, input.productName])
    .filter((keyword) => keyword.length >= 3)
    .slice(0, 5);
}

function dedupeRawCandidates(candidates: RawThreadCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.threadUrl.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return Boolean(candidate.threadTitle);
  });
}

function dedupeStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function parseJsonResult<T>(
  text: string,
  schema: z.ZodType<T>,
  label: string,
): T {
  const parsed = safeJsonParse(extractJsonObject(text), label);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new CommunityThreadScoringParseError(
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
    throw new CommunityThreadScoringParseError(
      `${label} response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeScore(value: number) {
  return Math.min(1, Math.max(0, Number((value / 100).toFixed(4))));
}

export class CommunityThreadScoringParseError extends Error {
  constructor(message: string) {
    super(`Community thread AI scoring could not be parsed: ${message}`);
    this.name = "CommunityThreadScoringParseError";
  }
}

const redditSearchResponseSchema = z.object({
  data: z.object({
    children: z.array(
      z.object({
        data: z.object({
          id: z.string(),
          title: z.string().nullable().optional(),
          author: z.string().nullable().optional(),
          permalink: z.string().nullable().optional(),
          selftext: z.string().nullable().optional(),
          created_utc: z.number().nullable().optional(),
          score: z.number().nullable().optional(),
          num_comments: z.number().nullable().optional(),
        }),
      }),
    ),
  }),
});

const hnSearchResponseSchema = z.object({
  hits: z.array(
    z.object({
      objectID: z.string(),
      title: z.string().nullable().optional(),
      author: z.string().nullable().optional(),
      story_text: z.string().nullable().optional(),
      created_at: z.string().nullable().optional(),
      points: z.number().nullable().optional(),
      num_comments: z.number().nullable().optional(),
    }),
  ),
});
