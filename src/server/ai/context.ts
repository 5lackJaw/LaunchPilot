import type { MarketingBrief } from "@/server/schemas/brief";

export function buildMarketingBriefContext(brief: MarketingBrief): string {
  return [
    `Tagline: ${brief.tagline}`,
    `Value propositions: ${brief.valueProps.join("; ")}`,
    `Personas: ${brief.personas.join("; ")}`,
    `Tone voice: ${brief.toneProfile.voice}`,
    `Tone avoid list: ${brief.toneProfile.avoid.join(", ")}`,
    `Keyword clusters: ${brief.keywordClusters
      .map((cluster) => `${cluster.name} (${cluster.keywords.join(", ")})`)
      .join("; ")}`,
    `Ranked channels: ${brief.channelsRanked
      .map((channel) => `${channel.channel}: ${channel.rationale}`)
      .join("; ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildLaunchBeaconSystemPrompt(input?: {
  brief?: MarketingBrief;
  extraInstructions?: string;
}): string {
  const parts = [
    "You are LaunchBeacon's marketing execution engine for solo developers and indie founders.",
    "Use plain language. Be specific, practical, and concise. Avoid marketing jargon, unsupported claims, and filler.",
    "When generating customer-visible copy, prioritize genuine usefulness over promotion.",
  ];

  if (input?.brief) {
    parts.push("Current Marketing Brief context:", buildMarketingBriefContext(input.brief));
  }

  if (input?.extraInstructions) {
    parts.push(input.extraInstructions);
  }

  return parts.join("\n\n");
}
