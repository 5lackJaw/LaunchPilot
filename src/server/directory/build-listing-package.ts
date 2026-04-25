import type { Directory } from "@/server/schemas/directory";
import type { MarketingBrief } from "@/server/schemas/brief";

export function buildDirectoryListingPackage(input: {
  productName: string;
  productUrl: string;
  directory: Directory;
  brief: MarketingBrief | null;
}) {
  const tagline = input.brief?.tagline ?? `${input.productName} helps teams launch with less manual work.`;
  const valueProps = input.brief?.valueProps.length ? input.brief.valueProps : ["Clear setup", "Focused workflow", "Useful automation"];
  const personas = input.brief?.personas.length ? input.brief.personas : ["Solo founders", "Indie developers"];

  return {
    productName: input.productName,
    productUrl: input.productUrl,
    directoryName: input.directory.name,
    tagline: tagline.slice(0, 160),
    shortDescription: `${tagline} Built for ${personas.slice(0, 2).join(" and ").toLowerCase()}.`.slice(0, 280),
    longDescription: [
      `${input.productName} is positioned for ${personas.slice(0, 3).join(", ")}.`,
      "Core value:",
      ...valueProps.slice(0, 5).map((value) => `- ${value}`),
      "",
      `Recommended fit for ${input.directory.name}: ${input.directory.categories.join(", ")}.`,
    ].join("\n"),
    categories: input.directory.categories,
    keywords: input.brief?.keywordClusters.flatMap((cluster) => cluster.keywords).slice(0, 12) ?? [],
    submissionMethod: input.directory.submissionMethod,
  };
}
