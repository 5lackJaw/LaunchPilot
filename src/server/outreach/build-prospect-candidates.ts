import type { MarketingBrief } from "@/server/schemas/brief";

export type ProspectCandidate = {
  name: string;
  email: string | null;
  publication: string;
  url: string;
  score: number;
  provenance: Record<string, unknown>;
};

export function buildProspectCandidates(input: { productName: string; productUrl: string; brief: MarketingBrief }): ProspectCandidate[] {
  const personas = input.brief.personas.length ? input.brief.personas : ["indie founders"];
  const competitors = input.brief.competitors.length ? input.brief.competitors : [input.productName];
  const clusters = input.brief.keywordClusters.length ? input.brief.keywordClusters : [{ name: "product launch", keywords: [input.productName] }];

  return clusters.slice(0, 5).map((cluster, index) => {
    const persona = personas[index % personas.length] ?? "founders";
    const competitor = competitors[index % competitors.length] ?? input.productName;
    const publication = publicationFor(index, persona);
    const slug = slugify(`${cluster.name}-${publication}`);
    const score = clampScore(0.9 - index * 0.07);

    return {
      name: `${titleCase(persona)} Editor`,
      email: null,
      publication,
      url: `https://example.com/outreach/${slug}`,
      score,
      provenance: {
        source: "deterministic-outreach-identification-v0",
        clusterName: cluster.name,
        seedKeyword: cluster.keywords[0] ?? cluster.name,
        persona,
        competitor,
        productUrl: input.productUrl,
        identifiedAt: new Date().toISOString(),
      },
    };
  });
}

function publicationFor(index: number, persona: string) {
  const options = ["Founder Notes", "Indie Stack Weekly", "SaaS Builder Brief", "Launch Ops Letter", "Dev Tools Digest"];
  return options[index % options.length] ?? `${titleCase(persona)} Weekly`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 80);
}

function clampScore(value: number) {
  return Math.min(1, Math.max(0, Number(value.toFixed(4))));
}
