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

export function buildThreadCandidates(input: { productName: string; brief: MarketingBrief }): CommunityThreadCandidate[] {
  const keywords = input.brief.keywordClusters.flatMap((cluster) => cluster.keywords.slice(0, 2)).slice(0, 5);
  const personas = input.brief.personas.length ? input.brief.personas : ["indie founders"];
  const valueProp = input.brief.valueProps[0] ?? input.brief.tagline;
  const scanSeeds = keywords.length ? keywords : [input.productName, valueProp].filter(Boolean);

  return scanSeeds.slice(0, 4).map((keyword, index) => {
    const platform = index % 2 === 0 ? "reddit" : "hacker_news";
    const audience = personas[index % personas.length] ?? "founders";
    const normalizedKeyword = normalizeForUrl(keyword);
    const relevanceScore = clampScore(0.9 - index * 0.07);
    const painSignalScore = clampScore(0.78 - index * 0.05);
    const audienceFitScore = clampScore(0.82 - index * 0.04);
    const recencyScore = clampScore(0.76 - index * 0.03);

    return {
      platform,
      threadUrl:
        platform === "reddit"
          ? `https://www.reddit.com/search/?q=${normalizedKeyword}`
          : `https://news.ycombinator.com/item?id=${100000 + index}`,
      threadTitle: buildTitle({ platform, keyword, audience }),
      threadAuthorHandle: platform === "reddit" ? `u/${normalizeForHandle(audience)}` : normalizeForHandle(audience),
      relevanceScore,
      painSignalScore,
      audienceFitScore,
      recencyScore,
      provenance: {
        source: "deterministic-community-ingestion-v0",
        keyword,
        audience,
        valueProp,
        generatedAt: new Date().toISOString(),
      },
    };
  });
}

function buildTitle(input: { platform: string; keyword: string; audience: string }) {
  if (input.platform === "reddit") {
    return `How are ${input.audience} handling ${input.keyword}?`;
  }

  return `Ask HN: What is the least painful way to solve ${input.keyword}?`;
}

function normalizeForUrl(value: string) {
  return encodeURIComponent(value.toLowerCase().replace(/\s+/g, " ").trim());
}

function normalizeForHandle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

function clampScore(value: number) {
  return Math.min(1, Math.max(0, Number(value.toFixed(4))));
}
