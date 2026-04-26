import type { MarketingBrief } from "@/server/schemas/brief";
import type { CommunityThread } from "@/server/schemas/community";

export type CommunityReplyDraft = {
  body: string;
  promotionalScore: number;
  confidence: number;
  rationale: string;
};

export function buildCommunityReplyDraft(input: { productName: string; brief: MarketingBrief; thread: CommunityThread }): CommunityReplyDraft {
  const persona = input.brief.personas[0] ?? "founders";
  const valueProp = input.brief.valueProps[0] ?? input.brief.tagline;
  const keyword = extractKeyword(input.thread);
  const confidence = clampScore((input.thread.relevanceScore + input.thread.audienceFitScore + input.thread.painSignalScore) / 3);
  const promotionalScore = clampScore(0.16 + Math.max(0, 0.5 - input.thread.painSignalScore) * 0.3);

  return {
    body: [
      `This is a common pain point for ${persona}, especially when ${keyword} has to be handled without turning it into a full-time process.`,
      "",
      `The practical approach I would take is to write down the repeatable checks first: what changed, who it affects, what the next manual decision is, and what should never happen automatically. That keeps the workflow useful without making it feel like a black box.`,
      "",
      `For ${valueProp.toLowerCase()}, I would also keep a short review step in place until the pattern is boring and predictable.`,
    ].join("\n"),
    promotionalScore,
    confidence,
    rationale: `Drafted from the current Marketing Brief and scored against relevance, audience fit, pain signal, and promotional risk for ${input.thread.platform}.`,
  };
}

function extractKeyword(thread: CommunityThread) {
  return thread.threadTitle
    .replace(/^Ask HN:\s*/i, "")
    .replace(/^How are\s+/i, "")
    .replace(/[?]+$/g, "")
    .trim()
    .toLowerCase();
}

function clampScore(value: number) {
  return Math.min(1, Math.max(0, Number(value.toFixed(4))));
}
