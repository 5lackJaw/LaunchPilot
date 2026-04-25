export type InitialBriefInputs = {
  product: { id: string; name: string; url: string };
  crawl: { id: string; page_title: string | null; meta_description: string | null; h1: string | null } | null;
  answers: Array<{ question_id: string; answer: string }>;
  nextVersion: number;
};

export function buildInitialBrief(inputs: InitialBriefInputs) {
  const answers = Object.fromEntries(inputs.answers.map((answer) => [answer.question_id, answer.answer.trim()]));
  const bestCustomer = answers.best_customer || "Best-fit customers need confirmation in the interview.";
  const pain = answers.pain || "Primary customer pain still needs confirmation.";
  const difference = answers.difference || "Differentiation still needs confirmation.";
  const proof = answers.proof || "Proof points still need confirmation.";
  const tone = answers.tone || "Direct and practical";
  const pageTitle = inputs.crawl?.page_title ?? inputs.crawl?.h1 ?? inputs.product.name;
  const metaDescription = inputs.crawl?.meta_description ?? "";
  const seedKeyword = normalizeKeyword(inputs.crawl?.h1 ?? pageTitle ?? inputs.product.name);

  return {
    version: inputs.nextVersion,
    tagline: firstSentence(metaDescription) || `${inputs.product.name} helps ${bestCustomer.toLowerCase()} solve a specific launch problem.`,
    valueProps: [pain, difference, proof].filter(Boolean),
    personas: [bestCustomer],
    competitors: [],
    keywordClusters: [
      {
        name: "Core product intent",
        keywords: [seedKeyword, `${seedKeyword} alternative`, `${seedKeyword} guide`],
      },
      {
        name: "Problem-aware searches",
        keywords: [normalizeKeyword(pain), `how to ${normalizeKeyword(pain)}`],
      },
    ],
    toneProfile: {
      voice: tone,
      avoid: ["marketing jargon", "unsupported claims", "overpromising automation"],
    },
    channelsRanked: [
      {
        channel: "SEO content",
        rationale: "Crawl and interview inputs provide enough product context for durable evergreen content.",
      },
      {
        channel: "Community",
        rationale: "Founder-authored answers can guide helpful, review-gated replies.",
      },
      {
        channel: "Directories",
        rationale: "The product URL and positioning inputs can seed listing packages.",
      },
    ],
    contentCalendarSeed: [
      {
        title: `${titleCase(seedKeyword)} guide`,
        format: "article",
        rationale: "Start with bottom-of-funnel product intent from the crawled page.",
      },
      {
        title: `How ${bestCustomer.toLowerCase()} can solve ${pain.toLowerCase()}`,
        format: "problem guide",
        rationale: "Translate the interview pain point into a practical search-focused topic.",
      },
      {
        title: `${inputs.product.name} vs manual alternatives`,
        format: "comparison",
        rationale: "Explain the product difference in a buyer-friendly format.",
      },
    ],
    provenance: {
      generator: "deterministic-v0",
      productId: inputs.product.id,
      crawlResultId: inputs.crawl?.id ?? null,
      interviewAnswerCount: inputs.answers.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

function firstSentence(value: string) {
  return value.split(/[.!?]/)[0]?.trim() ?? "";
}

function normalizeKeyword(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
