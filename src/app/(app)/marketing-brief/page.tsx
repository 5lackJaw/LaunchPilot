import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AppTopbar } from "@/components/layout/app-topbar";
import { WorkflowStatusRefresh } from "@/components/workflow-status-refresh";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateMarketingBriefNowAction, setCurrentMarketingBriefVersionAction } from "@/app/(app)/marketing-brief/actions";
import { WorkflowActionPanel } from "@/app/(app)/marketing-brief/workflow-action-panel";
import type { BriefGenerationJob } from "@/server/schemas/brief-generation-job";
import type { MarketingBrief } from "@/server/schemas/brief";
import type { CrawlJob, CrawlResult } from "@/server/schemas/crawl";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError, AuthService } from "@/server/services/auth-service";
import { BriefReadError, BriefService } from "@/server/services/brief-service";
import { CrawlReadError, CrawlService } from "@/server/services/crawl-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

type PageProps = {
  searchParams: Promise<{
    saved?: string;
    saveError?: string;
    generated?: string;
    generationStarted?: string;
    generationError?: string;
    crawlStarted?: string;
    crawlError?: string;
    versionChanged?: string;
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

  const crawlInFlight = data.crawlJob?.status === "queued" || data.crawlJob?.status === "running";
  const briefGenerationInFlight = data.briefGenerationJob?.status === "queued" || data.briefGenerationJob?.status === "running";
  const flashCrawlComplete = Boolean(params.crawlStarted && data.crawlJob?.status === "completed");
  const flashBriefComplete = Boolean(params.generationStarted && data.briefGenerationJob?.status === "completed");

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--lp-bg)" }}>
      <WorkflowStatusRefresh enabled={crawlInFlight || briefGenerationInFlight || flashCrawlComplete || flashBriefComplete} />
      <AppTopbar
        title="Marketing Brief"
        productName={data.product?.name}
        actions={
          data.brief ? (
            <>
              <span style={versionBadgeStyle}>Version {data.brief.version}</span>
              {data.product ? (
                <Link href={`/onboarding/brief?productId=${data.product.id}`} style={topbarSecondaryStyle}>
                  Edit brief
                </Link>
              ) : null}
            </>
          ) : null
        }
      />

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", overflow: "hidden" }}>
        <div style={{ overflowY: "auto", padding: "24px 28px 48px" }}>
          {params.saveError ? <TransientError title="Save failed" message={params.saveError} /> : null}
          {params.versionChanged ? <TransientNotice title="Brief version changed" message="The selected Marketing Brief version is now current." /> : null}
          {params.generationError ? <TransientError title="Generation could not start" message={params.generationError} /> : null}
          {params.crawlError ? <TransientError title="Crawl could not start" message={params.crawlError} /> : null}
          {data.briefGenerationJob?.status === "failed" ? (
            <WorkflowFailureCallout
              title="Brief generation failed"
              detail={data.briefGenerationJob.errorMessage ?? "The workflow stopped before the brief was generated."}
              productId={data.product?.id ?? null}
              retryLabel="Retry generation"
            />
          ) : null}
          {data.crawlJob?.status === "failed" ? (
            <WorkflowFailureCallout
              title="Product crawl failed"
              detail={data.crawlJob.errorMessage ?? "The product page could not be crawled."}
              productId={data.product?.id ?? null}
              retryLabel="Retry crawl from Actions"
              retryDisabled
            />
          ) : null}

          {!data.product ? <NoProductEmptyState /> : null}
          {data.product && !data.brief ? <NoBriefEmptyState product={data.product} /> : null}
          {data.product && data.brief ? <BriefContent product={data.product} brief={data.brief} /> : null}
        </div>

        <aside style={{ borderLeft: "1px solid var(--lp-border)", background: "var(--lp-bg2)", overflowY: "auto" }}>
          <SideSection title="Brief metadata">
            <SideMeta label="Version" value={data.brief ? `v${data.brief.version}` : "None"} />
            <SideMeta label="Keyword clusters" value={data.brief ? String(data.brief.keywordClusters.length) : "0"} />
            <SideMeta label="Seed topics" value={data.brief ? String(data.brief.contentCalendarSeed.length) : "0"} />
            <SideMeta label="Last updated" value={data.brief ? formatDate(data.brief.updatedAt) : "Not generated"} />
            <SideMeta label="Crawl status" value={formatCrawlStatus(data.crawlJob, data.crawlResult)} accent={data.crawlJob?.status === "completed" ? "teal" : undefined} />
            <SideMeta label="Refresh limit" value={getNextRefreshLabel(data.crawlJob)} />
          </SideSection>

          <SideSection title="Actions">
            {data.product ? (
              <WorkflowActionPanel
                productId={data.product.id}
                hasBrief={Boolean(data.brief)}
                crawlJob={data.crawlJob}
                briefGenerationJob={data.briefGenerationJob}
                currentBriefVersion={data.brief?.version ?? null}
                flashCrawlComplete={flashCrawlComplete}
                flashBriefComplete={flashBriefComplete}
              />
            ) : (
              <p style={sideNoteStyle}>Create a product before running crawl or brief workflows.</p>
            )}
            <p style={sideNoteStyle}>
              Re-crawling fetches the latest product page. Regenerating creates a new brief version from the most recent crawl.
            </p>
          </SideSection>

          <SideSection title="Next action">
            <div style={nextActionCardStyle}>
              <p style={{ fontSize: "12.5px", color: "var(--lp-text)", lineHeight: 1.6, margin: "0 0 12px" }}>
                {data.brief ? (
                  <>
                    Brief v{data.brief.version} is current. <strong style={{ color: "var(--lp-purple-l)", fontWeight: 500 }}>{data.brief.keywordClusters.length} keyword clusters</strong> are ready for SEO planning.
                  </>
                ) : (
                  "Generate the first Marketing Brief before planning content or outreach."
                )}
              </p>
              <Link href={data.brief ? "/seo" : "/onboarding/crawl"} style={nextActionButtonStyle}>
                {data.brief ? "Open SEO opportunities" : "Start product setup"} →
              </Link>
            </div>
          </SideSection>

          <SideSection title="Saved versions">
            {data.briefVersions.length ? (
              data.briefVersions.map((version) => (
                <VersionHistoryItem
                  key={version.id}
                  productId={data.product?.id ?? ""}
                  brief={version}
                  current={version.id === data.brief?.id}
                />
              ))
            ) : (
              <p style={sideNoteStyle}>No brief versions yet.</p>
            )}
          </SideSection>
        </aside>
      </div>
    </main>
  );
}

function BriefContent({ product, brief }: { product: Product; brief: MarketingBrief }) {
  const clusterColors = ["var(--lp-purple)", "var(--lp-teal)", "var(--lp-amber)", "#5B9EF6", "#E879B8"];

  return (
    <>
      <div style={productHeroStyle}>
        <h2 style={productNameStyle}>{product.name}</h2>
        <p style={productUrlStyle}>{product.url}</p>
        <p style={taglineStyle}>{brief.tagline}</p>
      </div>

      <BriefSection label="Value propositions">
        <div>
          {brief.valueProps.map((valueProp, index) => (
            <div key={valueProp} style={listRowStyle(index === brief.valueProps.length - 1)}>
              <span style={rowNumberStyle}>{String(index + 1).padStart(2, "0")}</span>
              <span style={rowTextStyle}>{valueProp}</span>
            </div>
          ))}
        </div>
      </BriefSection>

      <BriefSection label="Target personas">
        {brief.personas.map((persona, index) => (
          <div key={persona} style={personaRowStyle(index === brief.personas.length - 1)}>
            <span style={personaBadgeStyle(index)}>{index === 0 ? "primary" : index === 1 ? "secondary" : `persona ${index + 1}`}</span>
            <span style={rowTextStyle}>{persona}</span>
          </div>
        ))}
      </BriefSection>

      <BriefSection label="Competitors · positioning gaps">
        {brief.competitors.length ? (
          brief.competitors.map((competitor, index) => (
            <div key={competitor} style={competitorRowStyle(index === brief.competitors.length - 1)}>
              <div style={{ minWidth: "140px", flexShrink: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--lp-text)" }}>{competitor}</div>
              </div>
              <p style={{ fontSize: "12.5px", color: "var(--lp-muted2)", lineHeight: 1.5, margin: 0 }}>
                Track as a positioning reference when generating comparison content and outreach angles.
              </p>
            </div>
          ))
        ) : (
          <EmptyCardRow>No competitors identified yet.</EmptyCardRow>
        )}
      </BriefSection>

      <BriefSection label="Tone & voice">
        <div style={{ padding: "16px 18px" }}>
          <p style={toneTextStyle}>{brief.toneProfile.voice}</p>
          <div style={toneLabelStyle}>Avoid list</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {brief.toneProfile.avoid.map((item) => (
              <span key={item} style={avoidTagStyle}>{item}</span>
            ))}
          </div>
        </div>
      </BriefSection>

      <BriefSection label="Keyword clusters">
        {brief.keywordClusters.map((cluster, index) => (
          <div key={cluster.name} style={clusterBlockStyle(index === brief.keywordClusters.length - 1)}>
            <div style={clusterHeaderStyle}>
              <span style={{ ...clusterDotStyle, background: clusterColors[index % clusterColors.length] }} />
              <span style={clusterNameStyle}>{cluster.name}</span>
              <span style={clusterCountStyle}>{cluster.keywords.length} keywords</span>
            </div>
            <p style={clusterKeywordsStyle}>{cluster.keywords.join(" · ")}</p>
          </div>
        ))}
      </BriefSection>

      <BriefSection label="Content calendar seeds · first 30 days">
        {brief.contentCalendarSeed.map((seed, index) => (
          <div key={seed.title} style={seedRowStyle(index === brief.contentCalendarSeed.length - 1)}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={seedTitleStyle}>{seed.title}</span>
              <span style={seedTypeStyle}>{seed.format}</span>
            </div>
            <p style={seedDescStyle}>{seed.rationale}</p>
          </div>
        ))}
      </BriefSection>

      <BriefSection label="Channel strategy · ranked by expected ROI">
        {brief.channelsRanked.map((channel, index) => (
          <div key={channel.channel} style={channelRowStyle(index === brief.channelsRanked.length - 1)}>
            <div style={channelIconStyle}>{index + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={channelNameStyle}>{channel.channel}</div>
              <div style={channelDescStyle}>{channel.rationale}</div>
            </div>
            <span style={channelStatusStyle}>Ready</span>
          </div>
        ))}
      </BriefSection>
    </>
  );
}

function BriefSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "28px" }}>
      <div style={briefLabelStyle}>{label}</div>
      <div style={briefCardStyle}>{children}</div>
    </section>
  );
}

function WorkflowFailureCallout({
  title,
  detail,
  productId,
  retryLabel,
  retryDisabled,
}: {
  title: string;
  detail: string;
  productId: string | null;
  retryLabel: string;
  retryDisabled?: boolean;
}) {
  return (
    <div style={failureCalloutStyle}>
      <div style={{ color: "var(--lp-red)", fontSize: "16px", lineHeight: 1.4 }}>!</div>
      <div style={{ flex: 1 }}>
        <h2 style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--lp-text)", margin: "0 0 8px" }}>{title}</h2>
        <p style={{ fontSize: "13px", color: "var(--lp-text)", lineHeight: 1.6, margin: "0 0 10px" }}>
          This usually resolves on retry.
        </p>
        <details style={{ marginBottom: "12px" }}>
          <summary style={{ fontSize: "12px", color: "var(--lp-muted2)", cursor: "pointer" }}>View raw log</summary>
          <pre style={rawLogStyle}>{detail}</pre>
        </details>
        {productId && !retryDisabled ? (
          <form action={generateMarketingBriefNowAction} style={{ display: "inline-flex" }}>
            <input type="hidden" name="productId" value={productId} />
            <button type="submit" style={failureRetryStyle}>{retryLabel}</button>
          </form>
        ) : (
          <span style={{ fontSize: "12px", color: "var(--lp-muted)" }}>{retryLabel}</span>
        )}
      </div>
    </div>
  );
}

function TransientError({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <Alert variant="destructive">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </div>
  );
}

function TransientNotice({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <Alert>
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </div>
  );
}

function NoProductEmptyState() {
  return (
    <div style={emptyStateStyle}>
      <h2 style={emptyTitleStyle}>No product yet</h2>
      <p style={emptyTextStyle}>Create a product before generating a Marketing Brief.</p>
      <Link href="/onboarding/crawl" style={nextActionButtonStyle}>Start product setup</Link>
    </div>
  );
}

function NoBriefEmptyState({ product }: { product: Product }) {
  return (
    <div style={emptyStateStyle}>
      <h2 style={emptyTitleStyle}>No Marketing Brief yet</h2>
      <p style={emptyTextStyle}>Generate the first brief from your latest crawl and product interview answers.</p>
      <form action={generateMarketingBriefNowAction}>
        <input type="hidden" name="productId" value={product.id} />
        <button type="submit" style={nextActionButtonStyle}>Generate brief now</button>
      </form>
    </div>
  );
}

function SideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: "18px 20px", borderBottom: "1px solid var(--lp-border)" }}>
      <div style={sideEyebrowStyle}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{children}</div>
    </section>
  );
}

function SideMeta({ label, value, accent }: { label: string; value: string; accent?: "teal" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 0", gap: "10px" }}>
      <span style={{ color: "var(--lp-muted)", fontSize: "12.5px" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: accent === "teal" ? "var(--lp-teal)" : "var(--lp-text)", fontWeight: 500, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function VersionHistoryItem({ productId, brief, current }: { productId: string; brief: MarketingBrief; current?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 0", borderBottom: "1px solid var(--lp-border)" }}>
      <span style={{ width: "8px", height: "8px", borderRadius: "9999px", background: current ? "var(--lp-purple)" : "var(--lp-subtle)", boxShadow: current ? "0 0 0 3px var(--lp-purple-dim)" : undefined, marginTop: "4px", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "12px", color: "var(--lp-text)", fontWeight: 500 }}>v{brief.version}{current ? " · Current" : ""}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--lp-muted)", marginTop: "1px" }}>{formatDate(brief.updatedAt)}</div>
        <div style={{ fontSize: "11.5px", color: "var(--lp-muted)", marginTop: "2px", lineHeight: 1.5 }}>{brief.tagline}</div>
        {!current ? (
          <form action={setCurrentMarketingBriefVersionAction} style={{ marginTop: "8px" }}>
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="briefId" value={brief.id} />
            <button type="submit" style={versionSwitchButtonStyle}>Make current</button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
function EmptyCardRow({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "14px 18px", fontSize: "13px", color: "var(--lp-muted)" }}>{children}</div>;
}

async function loadMarketingBriefData(): Promise<{
  product: Product | null;
  brief: MarketingBrief | null;
  crawlJob: CrawlJob | null;
  crawlResult: CrawlResult | null;
  briefGenerationJob: BriefGenerationJob | null;
  briefVersions: MarketingBrief[];
  error: string | null;
  authRequired: boolean;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    await new AuthService(supabase).requireUser();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, brief: null, crawlJob: null, crawlResult: null, briefGenerationJob: null, briefVersions: [], error: null, authRequired: false };
    }

    const crawlService = new CrawlService(supabase);
    const briefService = new BriefService(supabase);
    const [brief, crawlJob, crawlResult, briefGenerationJob, briefVersions] = await Promise.all([
      briefService.getCurrentBrief({ productId: product.id }),
      crawlService.getLatestCrawlJob({ productId: product.id }),
      crawlService.getLatestCrawlResult({ productId: product.id }),
      briefService.getLatestGenerationJob({ productId: product.id }),
      briefService.listBriefVersions({ productId: product.id }),
    ]);

    return { product, brief, crawlJob, crawlResult, briefGenerationJob, briefVersions, error: null, authRequired: false };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, brief: null, crawlJob: null, crawlResult: null, briefGenerationJob: null, briefVersions: [], error: null, authRequired: true };
    }

    if (error instanceof ProductReadError || error instanceof BriefReadError || error instanceof CrawlReadError) {
      return { product: null, brief: null, crawlJob: null, crawlResult: null, briefGenerationJob: null, briefVersions: [], error: error.message, authRequired: false };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        brief: null,
        crawlJob: null,
        crawlResult: null,
        briefGenerationJob: null,
        briefVersions: [],
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
        authRequired: false,
      };
    }

    throw error;
  }
}

function BriefShell({ errorTitle, error, destructive }: { errorTitle: string; error: string; destructive?: boolean }) {
  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <AppTopbar title="Marketing Brief" />
      <div style={{ padding: "22px 28px" }}>
        <Alert variant={destructive ? "destructive" : "default"}>
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatCrawlStatus(crawlJob: CrawlJob | null, crawlResult: CrawlResult | null) {
  if (crawlJob?.status === "completed") {
    return `completed · ${formatDate(crawlJob.completedAt ?? crawlJob.updatedAt)}`;
  }

  if (crawlJob) {
    return crawlJob.status;
  }

  if (crawlResult) {
    return `completed · ${formatDate(crawlResult.createdAt)}`;
  }

  return "not started";
}

function getNextRefreshLabel(crawlJob: CrawlJob | null) {
  if (!crawlJob || crawlJob.status === "failed") {
    return "Available now";
  }

  const next = new Date(new Date(crawlJob.createdAt).getTime() + 24 * 60 * 60 * 1000);
  if (next.getTime() <= Date.now()) {
    return "Available now";
  }

  return formatDate(next.toISOString());
}

const versionBadgeStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: "10.5px",
  color: "var(--lp-purple-l)",
  padding: "3px 10px",
  borderRadius: "9999px",
  background: "var(--lp-purple-dim)",
  border: "1px solid rgba(124,111,247,0.2)",
};

const topbarSecondaryStyle = {
  display: "inline-flex",
  alignItems: "center",
  height: "32px",
  padding: "0 14px",
  borderRadius: "7px",
  fontSize: "12.5px",
  fontWeight: 500,
  textDecoration: "none",
  color: "var(--lp-text)",
  background: "var(--lp-bg3)",
  border: "1px solid var(--lp-border)",
};

const productHeroStyle = {
  background: "linear-gradient(180deg,var(--lp-bg3) 0%,var(--lp-bg2) 100%)",
  border: "1px solid var(--lp-border)",
  borderRadius: "10px",
  padding: "24px",
  marginBottom: "24px",
};

const productNameStyle = {
  fontFamily: "var(--font-serif)",
  fontSize: "20px",
  fontWeight: 400,
  color: "var(--lp-text)",
  margin: "0 0 4px",
};

const productUrlStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  color: "var(--lp-muted)",
  margin: "0 0 14px",
};

const taglineStyle = {
  fontSize: "15px",
  color: "var(--lp-text)",
  lineHeight: 1.65,
  borderLeft: "3px solid var(--lp-purple)",
  paddingLeft: "16px",
  margin: "0 0 0 2px",
};

const briefLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  color: "var(--lp-muted)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginBottom: "12px",
  paddingBottom: "8px",
  borderBottom: "1px solid var(--lp-border)",
};

const briefCardStyle = {
  background: "var(--lp-bg3)",
  border: "1px solid var(--lp-border)",
  borderRadius: "10px",
  overflow: "hidden",
};

const listRowStyle = (last: boolean) => ({
  padding: "14px 18px",
  borderBottom: last ? "none" : "1px solid var(--lp-border)",
  display: "flex",
  gap: "12px",
});

const rowNumberStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  color: "var(--lp-muted)",
  paddingTop: "3px",
  flexShrink: 0,
  width: "18px",
};

const rowTextStyle = {
  fontSize: "13.5px",
  color: "var(--lp-text)",
  lineHeight: 1.6,
};

const personaRowStyle = (last: boolean) => ({
  padding: "16px 18px",
  borderBottom: last ? "none" : "1px solid var(--lp-border)",
  display: "flex",
  alignItems: "flex-start",
  gap: "14px",
});

const personaBadgeStyle = (index: number) => ({
  fontFamily: "var(--font-mono)",
  fontSize: "9.5px",
  padding: "3px 8px",
  borderRadius: "9999px",
  fontWeight: 500,
  flexShrink: 0,
  marginTop: "2px",
  color: index === 0 ? "var(--lp-teal)" : "var(--lp-amber)",
  background: index === 0 ? "var(--lp-teal-dim)" : "var(--lp-amber-dim)",
  border: index === 0 ? "1px solid rgba(45,212,160,0.25)" : "1px solid rgba(240,164,41,0.25)",
});

const competitorRowStyle = (last: boolean) => ({
  padding: "14px 18px",
  borderBottom: last ? "none" : "1px solid var(--lp-border)",
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
});

const toneTextStyle = {
  fontSize: "13.5px",
  color: "var(--lp-text)",
  lineHeight: 1.65,
  margin: "0 0 16px",
};

const toneLabelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  color: "var(--lp-muted)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginBottom: "8px",
};

const avoidTagStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  color: "var(--lp-red)",
  padding: "3px 9px",
  borderRadius: "4px",
  background: "var(--lp-red-dim)",
  border: "1px solid rgba(240,96,96,0.2)",
};

const clusterBlockStyle = (last: boolean) => ({
  padding: "12px 18px",
  borderBottom: last ? "none" : "1px solid var(--lp-border)",
});

const clusterHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const clusterDotStyle = {
  width: "8px",
  height: "8px",
  borderRadius: "2px",
  flexShrink: 0,
};

const clusterNameStyle = {
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--lp-text)",
  flex: 1,
};

const clusterCountStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: "10.5px",
  color: "var(--lp-muted)",
};

const clusterKeywordsStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: "10.5px",
  color: "var(--lp-muted2)",
  margin: "4px 0 0 18px",
  lineHeight: 1.8,
};

const seedRowStyle = (last: boolean) => ({
  padding: "14px 18px",
  borderBottom: last ? "none" : "1px solid var(--lp-border)",
});

const seedTitleStyle = {
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--lp-text)",
};

const seedTypeStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: "9.5px",
  padding: "2px 7px",
  borderRadius: "9999px",
  fontWeight: 500,
  color: "var(--lp-purple-l)",
  background: "var(--lp-purple-dim)",
  border: "1px solid rgba(124,111,247,0.2)",
  flexShrink: 0,
};

const seedDescStyle = {
  fontSize: "12.5px",
  color: "var(--lp-muted2)",
  lineHeight: 1.6,
  margin: 0,
};

const channelRowStyle = (last: boolean) => ({
  padding: "12px 18px",
  borderBottom: last ? "none" : "1px solid var(--lp-border)",
  display: "flex",
  alignItems: "center",
  gap: "12px",
});

const channelIconStyle = {
  width: "28px",
  height: "28px",
  borderRadius: "7px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  flexShrink: 0,
  background: "var(--lp-bg4)",
  border: "1px solid var(--lp-border2)",
};

const channelNameStyle = {
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--lp-text)",
};

const channelDescStyle = {
  fontSize: "11.5px",
  color: "var(--lp-muted)",
};

const channelStatusStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: "10.5px",
  color: "var(--lp-amber)",
};

const sideEyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: "10px",
  color: "var(--lp-muted)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginBottom: "10px",
};

const sideNoteStyle = {
  fontSize: "11.5px",
  color: "var(--lp-muted)",
  lineHeight: 1.6,
  margin: "6px 0 0",
};

const nextActionCardStyle = {
  background: "var(--lp-bg3)",
  border: "1px solid var(--lp-border)",
  borderRadius: "9px",
  padding: "14px 16px",
};

const nextActionButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "7px 14px",
  borderRadius: "7px",
  background: "var(--lp-purple)",
  color: "#fff",
  fontSize: "12.5px",
  fontWeight: 500,
  border: "none",
  cursor: "pointer",
  textDecoration: "none",
};

const emptyStateStyle = {
  background: "var(--lp-bg3)",
  border: "1px solid var(--lp-border)",
  borderRadius: "10px",
  padding: "32px 24px",
  textAlign: "center" as const,
};

const emptyTitleStyle = {
  fontFamily: "var(--font-serif)",
  fontSize: "20px",
  fontWeight: 400,
  color: "var(--lp-text)",
  margin: "0 0 10px",
};

const emptyTextStyle = {
  fontSize: "13px",
  color: "var(--lp-muted)",
  margin: "0 0 20px",
};

const failureCalloutStyle = {
  background: "var(--lp-red-dim)",
  border: "1px solid var(--lp-border)",
  borderLeft: "3px solid var(--lp-red)",
  borderRadius: "0 10px 10px 0",
  padding: "16px 20px",
  display: "flex",
  alignItems: "flex-start",
  gap: "14px",
  marginBottom: "22px",
};

const rawLogStyle = {
  margin: "8px 0 0",
  whiteSpace: "pre-wrap" as const,
  fontFamily: "var(--font-mono)",
  fontSize: "10.5px",
  color: "var(--lp-muted2)",
  lineHeight: 1.5,
};

const failureRetryStyle = {
  fontSize: "12.5px",
  fontWeight: 500,
  color: "#fff",
  background: "var(--lp-red)",
  border: "none",
  borderRadius: "7px",
  padding: "7px 14px",
  cursor: "pointer",
};

const versionSwitchButtonStyle = {
  fontSize: "11.5px",
  fontWeight: 500,
  color: "var(--lp-purple-l)",
  background: "var(--lp-purple-dim)",
  border: "1px solid rgba(124,111,247,0.2)",
  borderRadius: "6px",
  padding: "5px 9px",
  cursor: "pointer",
};
