import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { aiRouter, buildLaunchBeaconSystemPrompt } from "@/server/ai";
import type { MarketingBrief } from "@/server/schemas/brief";

export type ProspectCandidate = {
  name: string;
  email: string | null;
  publication: string;
  url: string;
  score: number;
  provenance: Record<string, unknown>;
};

type RawProspectCandidate = {
  id: string;
  name: string;
  publication: string;
  url: string;
  profileUrl: string | null;
  title: string;
  description: string;
  source: "devto" | "curated_publication";
  keyword: string;
};

const maxRawCandidates = 35;
const maxPersistedProspects = 10;

const prospectScoreSchema = z.object({
  prospects: z
    .array(
      z.object({
        id: z.string(),
        score: z.number().min(0).max(100),
        rationale: z.string().max(600),
      }),
    )
    .max(maxRawCandidates),
});

const prospectScoreJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    prospects: {
      type: "array",
      maxItems: maxRawCandidates,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          score: { type: "number" },
          rationale: { type: "string" },
        },
        required: ["id", "score", "rationale"],
      },
    },
  },
  required: ["prospects"],
};

export async function buildProspectCandidates(input: {
  supabase: SupabaseClient;
  productId: string;
  userId?: string;
  productName: string;
  productUrl: string;
  brief: MarketingBrief;
}): Promise<ProspectCandidate[]> {
  const keywords = selectProspectKeywords(input);
  const rawCandidates = dedupeRawCandidates(
    (
      await Promise.all(
        keywords.map((keyword) => fetchCandidatesForKeyword(keyword)),
      )
    ).flat(),
  ).slice(0, maxRawCandidates);

  if (!rawCandidates.length) {
    return [];
  }

  const scores = await scoreProspectCandidates({
    supabase: input.supabase,
    productId: input.productId,
    userId: input.userId,
    productName: input.productName,
    productUrl: input.productUrl,
    brief: input.brief,
    candidates: rawCandidates,
  });
  const scoreById = new Map(scores.prospects.map((score) => [score.id, score]));

  return rawCandidates
    .map((candidate): ProspectCandidate | null => {
      const score = scoreById.get(candidate.id);
      if (!score || score.score < 50) {
        return null;
      }

      return {
        name: candidate.name,
        email: null,
        publication: candidate.publication,
        url: candidate.profileUrl ?? candidate.url,
        score: normalizeScore(score.score),
        provenance: {
          source: "public-outreach-prospect-research-v1",
          discoverySource: candidate.source,
          articleUrl: candidate.url,
          profileUrl: candidate.profileUrl,
          title: candidate.title,
          description: candidate.description,
          keyword: candidate.keyword,
          rationale: score.rationale,
          productUrl: input.productUrl,
          identifiedAt: new Date().toISOString(),
          contactStatus: "email_not_discovered",
        },
      };
    })
    .filter((candidate): candidate is ProspectCandidate => Boolean(candidate))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPersistedProspects);
}

async function fetchCandidatesForKeyword(keyword: string): Promise<RawProspectCandidate[]> {
  const [devto] = await Promise.allSettled([fetchDevToCandidates(keyword)]);

  return [
    ...(devto.status === "fulfilled" ? devto.value : []),
    ...curatedPublicationCandidates(keyword),
  ];
}

async function fetchDevToCandidates(keyword: string): Promise<RawProspectCandidate[]> {
  const tag = keywordToDevToTag(keyword);
  if (!tag) {
    return [];
  }

  const url = `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&top=30&per_page=12`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "LaunchBeaconBot/0.1 outreach prospect research",
    },
  });

  if (!response.ok) {
    return [];
  }

  const payload = devToArticleSchema.array().safeParse(await response.json());
  if (!payload.success) {
    return [];
  }

  return payload.data
    .flatMap((article) => {
      if (!article.user?.name || !article.url) {
        return [];
      }

      return [{
        id: `devto:${article.id}`,
        name: article.user.name,
        publication: "DEV Community",
        url: article.url,
        profileUrl: article.user.username ? `https://dev.to/${article.user.username}` : null,
        title: cleanText(article.title),
        description: cleanText(article.description ?? ""),
        source: "devto" as const,
        keyword,
      }];
    });
}

function curatedPublicationCandidates(keyword: string): RawProspectCandidate[] {
  return curatedPublications.map((publication) => ({
    id: `curated:${publication.url}`,
    name: publication.contactName,
    publication: publication.name,
    url: publication.url,
    profileUrl: publication.url,
    title: publication.angle,
    description: publication.description,
    source: "curated_publication" as const,
    keyword,
  }));
}

async function scoreProspectCandidates(input: {
  supabase: SupabaseClient;
  productId: string;
  userId?: string;
  productName: string;
  productUrl: string;
  brief: MarketingBrief;
  candidates: RawProspectCandidate[];
}) {
  const result = await aiRouter.generateText({
    supabase: input.supabase,
    productId: input.productId,
    userId: input.userId,
    taskClass: "outreach_prospect_research",
    system: buildLaunchBeaconSystemPrompt({
      brief: input.brief,
      extraInstructions:
        "You score outreach prospects for founder-led, low-spam outreach. Favor real publications, writers, newsletters, and communities whose recent topics fit the product. Return strict JSON only.",
    }),
    prompt: [
      "Score each prospect from 0 to 100 for whether they are worth adding to an outreach list.",
      "Strong prospects cover the product category, target persona, or a pain point from the Marketing Brief.",
      "Do not inflate generic startup publications unless the angle is clear.",
      "Product:",
      JSON.stringify(
        {
          productName: input.productName,
          productUrl: input.productUrl,
          tagline: input.brief.tagline,
          valueProps: input.brief.valueProps,
          personas: input.brief.personas,
          keywordClusters: input.brief.keywordClusters,
          contentCalendarSeed: input.brief.contentCalendarSeed,
        },
        null,
        2,
      ),
      "Candidate prospects:",
      JSON.stringify(input.candidates, null, 2),
      "Return JSON with a prospects array. Include each candidate id at most once.",
    ].join("\n\n"),
    maxOutputTokens: 3200,
    temperature: 0.15,
    responseMimeType: "application/json",
    responseJsonSchema: prospectScoreJsonSchema,
    metadata: {
      stage: "outreach_prospect_research",
      candidateCount: input.candidates.length,
    },
  });

  return parseJsonResult(result.text);
}

function selectProspectKeywords(input: {
  productName: string;
  brief: MarketingBrief;
}) {
  const clusterKeywords = input.brief.keywordClusters
    .flatMap((cluster) => [cluster.name, ...cluster.keywords.slice(0, 2)])
    .map(cleanText)
    .filter(Boolean);
  const personaTerms = input.brief.personas.map(cleanText).filter(Boolean);

  return dedupeStrings([
    input.productName,
    ...clusterKeywords,
    ...personaTerms,
    "indie hackers",
    "saas",
  ])
    .filter((keyword) => keyword.length >= 3)
    .slice(0, 5);
}

function keywordToDevToTag(keyword: string) {
  const compact = keyword
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);

  const mapped: Record<string, string> = {
    saas: "saas",
    startup: "startup",
    indiehackers: "startup",
    developers: "devjournal",
    crypto: "crypto",
    web3: "web3",
    payments: "payments",
    ai: "ai",
    marketing: "marketing",
    seo: "seo",
  };

  return mapped[compact] ?? compact;
}

function dedupeRawCandidates(candidates: RawProspectCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = (candidate.profileUrl ?? candidate.url).toLowerCase();
    if (!candidate.url || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
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

function parseJsonResult(text: string) {
  const parsed = safeJsonParse(extractJsonObject(text));
  const result = prospectScoreSchema.safeParse(parsed);

  if (!result.success) {
    throw new OutreachProspectResearchParseError(
      `prospect research response did not match the required schema: ${result.error.message}`,
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
    throw new OutreachProspectResearchParseError(
      `prospect research response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeScore(value: number) {
  return Math.min(1, Math.max(0, Number((value / 100).toFixed(4))));
}

const devToArticleSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullable().optional(),
  url: z.string().url(),
  user: z
    .object({
      name: z.string(),
      username: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const curatedPublications = [
  {
    name: "Indie Hackers",
    contactName: "Indie Hackers Editor",
    url: "https://www.indiehackers.com/",
    angle: "Founder stories, bootstrapped products, growth experiments",
    description: "Community and publication for indie founders and bootstrapped SaaS builders.",
  },
  {
    name: "Starter Story",
    contactName: "Starter Story Editor",
    url: "https://www.starterstory.com/",
    angle: "Founder case studies and product/business launch stories",
    description: "Publication covering startup and founder stories with practical growth lessons.",
  },
  {
    name: "SaaSHub",
    contactName: "SaaSHub Editor",
    url: "https://www.saashub.com/",
    angle: "SaaS product discovery, alternatives, and category pages",
    description: "Software discovery site covering SaaS tools, alternatives, and categories.",
  },
  {
    name: "BetaList",
    contactName: "BetaList Team",
    url: "https://betalist.com/",
    angle: "Early-stage startup and product launch discovery",
    description: "Startup discovery publication for early adopters and new product launches.",
  },
  {
    name: "Product Hunt",
    contactName: "Product Hunt Team",
    url: "https://www.producthunt.com/",
    angle: "New product launches and founder-led product announcements",
    description: "Product launch community where makers share new software and tools.",
  },
] as const;

export class OutreachProspectResearchParseError extends Error {
  constructor(message: string) {
    super(`Outreach prospect research could not be parsed: ${message}`);
    this.name = "OutreachProspectResearchParseError";
  }
}
