import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AppTopbar } from "@/components/layout/app-topbar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { crawlProductForBriefAction, generateMarketingBriefNowAction } from "@/app/(app)/marketing-brief/actions";
import type { MarketingBrief } from "@/server/schemas/brief";
import type { CrawlJob, CrawlResult } from "@/server/schemas/crawl";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import { BriefReadError, BriefService } from "@/server/services/brief-service";
import { CrawlReadError, CrawlService } from "@/server/services/crawl-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

type PageProps = {
  searchParams: Promise<{
    saved?: string;
    saveError?: string;
    generated?: string;
    generationError?: string;
    crawlStarted?: string;
    crawlError?: string;
  }>;
};

export default async function MarketingBriefPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadMarketingBriefData();

  if (data.authRequired) {
    return <BriefShell errorTitle="Sign in required" error="Sign in before viewing the Marketing Brief." />;
  }

  if (data.error) {
    return <BriefShell errorTitle="Marketing Brief could not be loaded" error={data.error} destructive />;
  }

  const eyebrow = data.product ? `Product intelligence / ${data.product.name}` : "Product intelligence";

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <AppTopbar
        title="Marketing Brief"
        eyebrow={eyebrow}
        productName={data.product?.name}
        actions={
          data.brief ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted)", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "5px", padding: "3px 8px" }}>
                v{data.brief.version}
              </span>
              {data.product && (
                <form action={crawlProductForBriefAction}>
                  <input type="hidden" name="productId" value={data.product.id} />
                  <button type="submit" style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, color: "var(--lp-text)", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "6px", padding: "5px 12px", cursor: "pointer" }}>
                    Crawl site
                  </button>
                </form>
              )}
              {data.product && (
                <form action={generateMarketingBriefNowAction}>
                  <input type="hidden" name="productId" value={data.product.id} />
                  <button type="submit" style={{ fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, color: "#fff", background: "var(--lp-purple)", border: "none", borderRadius: "6px", padding: "5px 12px", cursor: "pointer" }}>
                    Regenerate from latest crawl
                  </button>
                </form>
              )}
            </div>
          ) : null
        }
      />

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 320px", overflow: "hidden" }}>
        {/* LEFT COLUMN */}
        <div style={{ overflowY: "auto", padding: "22px 28px 40px", display: "flex", flexDirection: "column", gap: "22px" }}>
          {params.saved && (
            <Alert>
              <AlertTitle>Marketing Brief saved</AlertTitle>
              <AlertDescription>A new version is now current and downstream planning will use it.</AlertDescription>
            </Alert>
          )}
          {params.generated && (
            <Alert>
              <AlertTitle>Marketing Brief generated</AlertTitle>
              <AlertDescription>Your brief is ready. Review it below and head to SEO to start planning content.</AlertDescription>
            </Alert>
          )}
          {params.saveError && (
            <Alert variant="destructive">
              <AlertTitle>Save failed</AlertTitle>
              <AlertDescription>{params.saveError}</AlertDescription>
            </Alert>
          )}
          {params.generationError && (
            <Alert variant="destructive">
              <AlertTitle>Generation failed</AlertTitle>
              <AlertDescription>{params.generationError}</AlertDescription>
            </Alert>
          )}
          {params.crawlStarted && (
            <Alert>
              <AlertTitle>Crawl started</AlertTitle>
              <AlertDescription>LaunchBeacon is fetching the product URL. Regenerate the brief after the crawl finishes.</AlertDescription>
            </Alert>
          )}
          {params.crawlError && (
            <Alert variant="destructive">
              <AlertTitle>Crawl failed to start</AlertTitle>
              <AlertDescription>{params.crawlError}</AlertDescription>
            </Alert>
          )}

          {!data.product && (
            <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", padding: "32px 24px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "20px", fontStyle: "italic", color: "var(--lp-text)", marginBottom: "10px" }}>No product yet</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-muted)", marginBottom: "20px" }}>Create a product during onboarding before editing a Marketing Brief.</div>
              <Link href="/onboarding/crawl" style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 500, color: "#fff", background: "var(--lp-purple)", textDecoration: "none", borderRadius: "6px", padding: "8px 16px" }}>
                Start onboarding
              </Link>
            </div>
          )}

          {data.product && !data.brief && (
            <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", padding: "32px 24px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "20px", fontStyle: "italic", color: "var(--lp-text)", marginBottom: "10px" }}>No Marketing Brief yet</div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-muted)", marginBottom: "20px" }}>
                Complete onboarding and generate the first brief before selecting SEO opportunities.
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <form action={generateMarketingBriefNowAction}>
                  <input type="hidden" name="productId" value={data.product.id} />
                  <button type="submit" style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 500, color: "#fff", background: "var(--lp-purple)", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer" }}>
                    Generate brief now
                  </button>
                </form>
                <Link href="/onboarding/interview" style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 500, color: "var(--lp-text)", background: "var(--lp-bg4)", textDecoration: "none", borderRadius: "6px", padding: "8px 16px", border: "1px solid var(--lp-border)" }}>
                  Continue interview
                </Link>
              </div>
            </div>
          )}

          {data.product && data.brief && (
            <BriefContent product={data.product} brief={data.brief} />
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ borderLeft: "1px solid var(--lp-border)", background: "var(--lp-bg2)", overflowY: "auto" }}>
          {/* Section: Brief metadata */}
          <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--lp-border)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>Brief metadata</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <SideMeta label="Version" value={data.brief ? `v${data.brief.version}` : "None"} />
              <SideMeta label="Keyword clusters" value={data.brief ? String(data.brief.keywordClusters.length) : "0"} />
              <SideMeta label="Value props" value={data.brief ? String(data.brief.valueProps.length) : "0"} />
              <SideMeta label="Last updated" value={data.brief ? formatDate(data.brief.updatedAt) : "Not generated"} />
              <SideMeta label="Latest crawl" value={data.crawlResult ? formatDate(data.crawlResult.createdAt) : "No crawl result"} />
              <SideMeta label="Crawl status" value={data.crawlJob ? `${data.crawlJob.status} (${data.crawlJob.progressPercent}%)` : "Not started"} />
            </div>
          </div>

          {/* Section: Actions */}
          <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--lp-border)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>Actions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {data.brief && data.product && (
                <Link href={`/onboarding/brief?productId=${data.product.id}`} style={{ width: "100%", fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, color: "var(--lp-text)", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "6px", padding: "7px 12px", cursor: "pointer", textAlign: "left", textDecoration: "none" }}>
                  Edit brief fields
                </Link>
              )}
              {data.product && (
                <form action={crawlProductForBriefAction}>
                  <input type="hidden" name="productId" value={data.product.id} />
                  <button type="submit" style={{ width: "100%", fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, color: "var(--lp-text)", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "6px", padding: "7px 12px", cursor: "pointer", textAlign: "left" }}>
                    Crawl product URL
                  </button>
                </form>
              )}
              {data.product && (
                <form action={generateMarketingBriefNowAction}>
                  <input type="hidden" name="productId" value={data.product.id} />
                  <button type="submit" style={{ width: "100%", fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, color: "var(--lp-purple-l, #A99DF9)", background: "var(--lp-purple-dim)", border: "1px solid var(--lp-border)", borderRadius: "6px", padding: "7px 12px", cursor: "pointer", textAlign: "left" }}>
                    Regenerate from latest crawl
                  </button>
                </form>
              )}
              {data.product && (
                <Link href="/settings/products" style={{ width: "100%", fontFamily: "var(--font-sans)", fontSize: "12px", fontWeight: 500, color: "var(--lp-muted2)", background: "transparent", border: "1px solid var(--lp-border)", borderRadius: "6px", padding: "7px 12px", cursor: "pointer", textAlign: "left", textDecoration: "none" }}>
                  Manage product
                </Link>
              )}
            </div>
          </div>

          {/* Section: Version history */}
          <div style={{ padding: "20px 22px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px" }}>Version history</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {data.brief ? (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-purple)", background: "var(--lp-purple-dim)", border: "1px solid rgba(124,111,247,0.2)", borderRadius: "4px", padding: "1px 6px", flexShrink: 0, marginTop: "1px" }}>v{data.brief.version}</span>
                  <div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--lp-text)" }}>Current brief version</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", marginTop: "2px" }}>{formatDate(data.brief.updatedAt)}</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--lp-muted)", lineHeight: 1.5 }}>
                  No brief versions yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function BriefContent({ product, brief }: { product: Product; brief: MarketingBrief }) {
  const clusterColors = ["var(--lp-purple)", "var(--lp-teal)", "var(--lp-amber)", "#60A5FA", "#F472B6"];

  return (
    <>
      {/* Product header block */}
      <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px", padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600, color: "var(--lp-text)" }}>{product.name}</div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "4px", padding: "2px 7px", flexShrink: 0 }}>v{brief.version}</span>
        </div>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: "18px", fontStyle: "italic", color: "var(--lp-text)", lineHeight: 1.5 }}>{brief.tagline}</div>
      </div>

      {/* Value Propositions */}
      <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", borderRadius: "10px 10px 0 0" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Value propositions</div>
        </div>
        <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {brief.valueProps.map((vp) => (
            <div key={vp} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <span style={{ color: "var(--lp-purple)", fontWeight: 700, flexShrink: 0, marginTop: "2px" }}>·</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-text)", lineHeight: 1.6 }}>{vp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Personas */}
      <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", borderRadius: "10px 10px 0 0" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Personas</div>
        </div>
        <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {brief.personas.map((persona, i) => (
            <div key={persona} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "4px", padding: "2px 6px", flexShrink: 0, marginTop: "2px" }}>
                {i === 0 ? "Primary" : i === 1 ? "Secondary" : `P${i + 1}`}
              </span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-text)", lineHeight: 1.6 }}>{persona}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Competitors */}
      <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", borderRadius: "10px 10px 0 0" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Competitors</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {brief.competitors.map((comp, i) => (
            <div key={comp} style={{ padding: "12px 18px", borderBottom: i < brief.competitors.length - 1 ? "1px solid var(--lp-border)" : "none" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-text)" }}>{comp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tone & Voice */}
      <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", borderRadius: "10px 10px 0 0" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Tone & Voice</div>
        </div>
        <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--lp-text)", lineHeight: 1.7, margin: 0 }}>{brief.toneProfile.voice}</p>
          {brief.toneProfile.avoid.length > 0 && (
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Avoid</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {brief.toneProfile.avoid.map((word) => (
                  <span key={word} style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-red, #F06060)", background: "rgba(240,96,96,0.12)", border: "1px solid rgba(240,96,96,0.25)", borderRadius: "4px", padding: "2px 7px" }}>{word}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keyword Clusters */}
      <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", borderRadius: "10px 10px 0 0" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Keyword clusters</div>
        </div>
        <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {brief.keywordClusters.map((cluster, i) => {
            const color = clusterColors[i % clusterColors.length];
            return (
              <div key={cluster.name}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 500, color: "var(--lp-text)" }}>{cluster.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", background: "var(--lp-bg4)", borderRadius: "4px", padding: "1px 6px", marginLeft: "auto" }}>{cluster.keywords.length} kw</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  {cluster.keywords.map((kw) => (
                    <span key={kw} style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-muted2, #8A8A95)", background: "var(--lp-bg4)", border: "1px solid var(--lp-border)", borderRadius: "4px", padding: "2px 7px" }}>{kw}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content Calendar Seeds */}
      {brief.contentCalendarSeed.length > 0 && (
        <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", borderRadius: "10px 10px 0 0" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Content calendar seeds</div>
          </div>
          <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            {brief.contentCalendarSeed.slice(0, 5).map((item) => (
              <div key={item.title}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 500, color: "var(--lp-text)" }}>{item.title}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-teal)", background: "rgba(45,212,160,0.10)", border: "1px solid rgba(45,212,160,0.2)", borderRadius: "4px", padding: "1px 6px", flexShrink: 0 }}>{item.format}</span>
                </div>
                <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--lp-muted)", lineHeight: 1.6, margin: 0 }}>{item.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Channel Ranking */}
      {brief.channelsRanked.length > 0 && (
        <div style={{ background: "var(--lp-bg3)", border: "1px solid var(--lp-border)", borderRadius: "10px" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--lp-border)", borderRadius: "10px 10px 0 0" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Channel ranking</div>
          </div>
          <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {brief.channelsRanked.map((item, i) => (
              <div key={item.channel} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--lp-muted)", width: "20px", flexShrink: 0, paddingTop: "2px" }}>{i + 1}</span>
                <div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 500, color: "var(--lp-text)", marginBottom: "3px" }}>{item.channel}</div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--lp-muted)", lineHeight: 1.5 }}>{item.rationale}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SideMeta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--lp-muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--lp-text)" }}>{value}</span>
    </div>
  );
}

function BriefShell({ errorTitle, error, destructive }: { errorTitle: string; error: string; destructive?: boolean }) {
  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <AppTopbar title="Marketing Brief" eyebrow="Product intelligence" />
      <div style={{ padding: "22px 28px" }}>
        <Alert variant={destructive ? "destructive" : "default"}>
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    </main>
  );
}

async function loadMarketingBriefData(): Promise<{
  product: Product | null;
  brief: MarketingBrief | null;
  crawlJob: CrawlJob | null;
  crawlResult: CrawlResult | null;
  error: string | null;
  authRequired: boolean;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, brief: null, crawlJob: null, crawlResult: null, error: null, authRequired: false };
    }

    const crawlService = new CrawlService(supabase);
    const [brief, crawlJob, crawlResult] = await Promise.all([
      new BriefService(supabase).getCurrentBrief({ productId: product.id }),
      crawlService.getLatestCrawlJob({ productId: product.id }),
      crawlService.getLatestCrawlResult({ productId: product.id }),
    ]);

    return { product, brief, crawlJob, crawlResult, error: null, authRequired: false };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, brief: null, crawlJob: null, crawlResult: null, error: null, authRequired: true };
    }

    if (error instanceof ProductReadError || error instanceof BriefReadError || error instanceof CrawlReadError) {
      return { product: null, brief: null, crawlJob: null, crawlResult: null, error: error.message, authRequired: false };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        brief: null,
        crawlJob: null,
        crawlResult: null,
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
        authRequired: false,
      };
    }

    throw error;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}
