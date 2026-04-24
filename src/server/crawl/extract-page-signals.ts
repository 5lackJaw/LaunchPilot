import * as cheerio from "cheerio";

export type ExtractedPageSignals = {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  headings: string[];
  canonicalUrl: string | null;
  openGraphTitle: string | null;
  openGraphDescription: string | null;
};

export function extractPageSignals(html: string): ExtractedPageSignals {
  const $ = cheerio.load(html);

  return {
    title: cleanText($("title").first().text()),
    metaDescription: cleanText($('meta[name="description"]').attr("content")),
    h1: cleanText($("h1").first().text()),
    headings: $("h1, h2")
      .map((_, element) => cleanText($(element).text()))
      .get()
      .filter((heading): heading is string => Boolean(heading))
      .slice(0, 12),
    canonicalUrl: cleanText($('link[rel="canonical"]').attr("href")),
    openGraphTitle: cleanText($('meta[property="og:title"]').attr("content")),
    openGraphDescription: cleanText($('meta[property="og:description"]').attr("content")),
  };
}

function cleanText(value: string | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 500) : null;
}
