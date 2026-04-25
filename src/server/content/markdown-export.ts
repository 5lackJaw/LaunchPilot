import type { ContentAsset } from "@/server/schemas/content";

export function buildMarkdownExport(asset: ContentAsset) {
  const frontmatter = [
    "---",
    `title: ${yamlString(asset.title)}`,
    asset.metaTitle ? `meta_title: ${yamlString(asset.metaTitle)}` : null,
    asset.metaDescription ? `meta_description: ${yamlString(asset.metaDescription)}` : null,
    asset.targetKeyword ? `target_keyword: ${yamlString(asset.targetKeyword)}` : null,
    `content_type: ${yamlString(asset.type)}`,
    `status: ${yamlString(asset.status)}`,
    `brief_version: ${asset.briefVersion}`,
    asset.aiConfidence === null ? null : `ai_confidence: ${asset.aiConfidence}`,
    `exported_at: ${yamlString(new Date().toISOString())}`,
    "---",
  ].filter(Boolean);

  return `${frontmatter.join("\n")}\n\n${asset.bodyMd.trim()}\n`;
}

export function contentAssetMarkdownFilename(asset: ContentAsset) {
  const slug = slugify(asset.title || asset.targetKeyword || asset.id);
  return `${slug || asset.id}.md`;
}

function yamlString(value: string) {
  return JSON.stringify(value);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}
