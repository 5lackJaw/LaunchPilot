import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AppTopbar } from "@/components/layout/app-topbar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  crawlProductFromSettingsAction,
  createProductFromSettingsAction,
  deleteProductAction,
  setActiveProductAction,
  updateProductAction,
} from "@/app/(app)/settings/products/actions";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

type PageProps = {
  searchParams: Promise<{
    productId?: string;
    created?: string;
    saved?: string;
    active?: string;
    duplicate?: string;
    crawlStarted?: string;
    deleted?: string;
    createError?: string;
    saveError?: string;
    activeError?: string;
    crawlError?: string;
    deleteError?: string;
  }>;
};

const productLimits: Record<string, string> = {
  free: "1 product",
  launch: "3 products",
  growth: "10 products",
};

export default async function ProductsSettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadProductsData(params.productId);

  if (data.authRequired) {
    return <ProductsShell errorTitle="Sign in required" error="Sign in before managing products." />;
  }

  if (data.error) {
    return <ProductsShell errorTitle="Products could not be loaded" error={data.error} destructive />;
  }

  const activeProduct = data.activeProduct;
  const selectedProduct = data.selectedProduct ?? activeProduct ?? data.products[0] ?? null;
  const planLimit = productLimits[data.planTier ?? "free"] ?? productLimits.free;

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <AppTopbar
        title="Products"
        eyebrow="Product settings"
        productName={activeProduct?.name}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/marketing-brief">Open brief</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/onboarding/crawl">Add product</Link>
            </Button>
          </div>
        }
      />

      <div className="grid flex-1 overflow-hidden lg:grid-cols-[340px_1fr]">
        <aside className="overflow-y-auto border-r bg-[color:var(--lp-bg2)] p-5">
          <div className="mb-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Products</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.products.length} of {planLimit} on the {data.planTier ?? "free"} plan
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {data.products.map((product) => {
              const isActive = activeProduct?.id === product.id;
              const isSelected = selectedProduct?.id === product.id;
              return (
                <Link
                  key={product.id}
                  href={`/settings/products?productId=${product.id}`}
                  className="rounded-[10px] border p-3 transition-colors"
                  style={{
                    background: isSelected ? "var(--lp-bg3)" : "transparent",
                    borderColor: isSelected ? "var(--lp-border2)" : "var(--lp-border)",
                    textDecoration: "none",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-[13px] font-medium text-foreground">{product.name}</span>
                    {isActive ? (
                      <span className="shrink-0 rounded-full border border-[rgba(45,212,160,0.15)] bg-[rgba(45,212,160,0.10)] px-2 py-0.5 font-mono text-[9.5px] text-[color:var(--lp-teal)]">
                        active
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate font-mono text-[10.5px] text-muted-foreground">{product.url}</p>
                </Link>
              );
            })}

            {!data.products.length ? (
              <div className="rounded-[10px] border bg-card p-4">
                <p className="text-sm font-medium">No products yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Add your first product to start crawling and generating a Marketing Brief.</p>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="overflow-y-auto p-7">
          <div className="mx-auto flex max-w-4xl flex-col gap-5">
            <StatusAlerts params={params} />

            <div className="rounded-[10px] border bg-card">
              <div className="border-b px-5 py-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Active product</p>
                <h2 className="mt-1 font-serif text-[20px] font-normal text-foreground">
                  {activeProduct?.name ?? "No active product"}
                </h2>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-3">
                <Meta label="Selection rule" value="All app pages use the active product unless a page URL specifies another product." />
                <Meta label="Regenerate brief" value="Uses the latest completed crawl and interview answers. It does not crawl the site first." />
                <Meta label="Crawl site" value="Fetches the product URL and stores fresh page signals for the next brief generation." />
              </div>
            </div>

            {selectedProduct ? (
              <SelectedProductPanel product={selectedProduct} isActive={activeProduct?.id === selectedProduct.id} />
            ) : null}

            {selectedProduct ? (
              <DeleteProductPanel product={selectedProduct} />
            ) : null}

            <div className="rounded-[10px] border bg-card">
              <div className="border-b px-5 py-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Add product</p>
                <h2 className="mt-1 font-serif text-[18px] font-normal text-foreground">Create another product</h2>
              </div>
              <form action={createProductFromSettingsAction} className="grid gap-4 p-5 md:grid-cols-[1fr_1.4fr_auto]">
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Name</span>
                  <input name="name" className="h-9 rounded-md border bg-background px-3 text-sm text-foreground" placeholder="Acme Analytics" required />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">URL</span>
                  <input name="url" type="url" className="h-9 rounded-md border bg-background px-3 text-sm text-foreground" placeholder="https://example.com" required />
                </label>
                <div className="flex items-end">
                  <Button type="submit">Add product</Button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function DeleteProductPanel({ product }: { product: Product }) {
  return (
    <div className="rounded-[10px] border border-destructive/30 bg-card">
      <div className="border-b border-destructive/20 px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-destructive">Danger zone</p>
        <h2 className="mt-1 font-serif text-[18px] font-normal text-foreground">Delete product</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Deletes this product and its briefs, crawls, inbox items, content, community threads, outreach contacts, analytics snapshots, and directory submissions.
        </p>
      </div>
      <form action={deleteProductAction} className="grid gap-4 p-5 md:grid-cols-[1fr_auto]">
        <input type="hidden" name="productId" value={product.id} />
        <input type="hidden" name="productName" value={product.name} />
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Type product name to confirm
          </span>
          <input
            name="confirmation"
            className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
            placeholder={product.name}
            autoComplete="off"
            required
          />
        </label>
        <div className="flex items-end">
          <Button type="submit" variant="destructive">Delete product</Button>
        </div>
      </form>
    </div>
  );
}

function SelectedProductPanel({ product, isActive }: { product: Product; isActive: boolean }) {
  return (
    <div className="rounded-[10px] border bg-card">
      <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Selected product</p>
          <h2 className="mt-1 font-serif text-[18px] font-normal text-foreground">{product.name}</h2>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{product.url}</p>
        </div>
        {!isActive ? (
          <form action={setActiveProductAction}>
            <input type="hidden" name="productId" value={product.id} />
            <Button type="submit" size="sm">Make active</Button>
          </form>
        ) : (
          <span className="rounded-full border border-[rgba(45,212,160,0.15)] bg-[rgba(45,212,160,0.10)] px-2 py-1 font-mono text-[10px] text-[color:var(--lp-teal)]">
            active
          </span>
        )}
      </div>

      <form action={updateProductAction} className="grid gap-4 p-5 md:grid-cols-[1fr_1.4fr_auto]">
        <input type="hidden" name="productId" value={product.id} />
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Name</span>
          <input name="name" defaultValue={product.name} className="h-9 rounded-md border bg-background px-3 text-sm text-foreground" required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">URL</span>
          <input name="url" type="url" defaultValue={product.url} className="h-9 rounded-md border bg-background px-3 text-sm text-foreground" required />
        </label>
        <div className="flex items-end">
          <Button type="submit" variant="outline">Save</Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2 border-t px-5 py-4">
        <form action={crawlProductFromSettingsAction}>
          <input type="hidden" name="productId" value={product.id} />
          <Button type="submit" variant="outline">Crawl site</Button>
        </form>
        <Button asChild>
          <Link href="/marketing-brief">Open Marketing Brief</Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          Crawl first when the site changed. Regenerate the brief from Marketing Brief after the crawl completes.
        </p>
      </div>
    </div>
  );
}

function StatusAlerts({ params }: { params: Awaited<PageProps["searchParams"]> }) {
  const alerts: Array<{ title: string; message: string; destructive?: boolean }> = [];
  if (params.created) alerts.push({ title: "Product added", message: "The new product is now active." });
  if (params.saved) alerts.push({ title: "Product saved", message: "Product details were updated. Crawl the site if the URL or page content changed." });
  if (params.active) alerts.push({ title: "Active product changed", message: "App pages now use this product by default." });
  if (params.duplicate) alerts.push({ title: "Product already exists", message: "That URL is already attached to a product." });
  if (params.crawlStarted) alerts.push({ title: "Crawl started", message: "Refresh this page or open onboarding crawl to watch progress." });
  if (params.deleted) alerts.push({ title: "Product deleted", message: "The product and its product-scoped records were deleted." });
  if (params.createError) alerts.push({ title: "Product could not be added", message: params.createError, destructive: true });
  if (params.saveError) alerts.push({ title: "Product could not be saved", message: params.saveError, destructive: true });
  if (params.activeError) alerts.push({ title: "Active product could not be changed", message: params.activeError, destructive: true });
  if (params.crawlError) alerts.push({ title: "Crawl could not be started", message: params.crawlError, destructive: true });
  if (params.deleteError) alerts.push({ title: "Product could not be deleted", message: params.deleteError, destructive: true });

  return (
    <>
      {alerts.map((alert) => (
        <Alert key={`${alert.title}-${alert.message}`} variant={alert.destructive ? "destructive" : "default"}>
          <AlertTitle>{alert.title}</AlertTitle>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      ))}
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

function ProductsShell({ errorTitle, error, destructive }: { errorTitle: string; error: string; destructive?: boolean }) {
  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar title="Products" eyebrow="Product settings" />
      <div className="p-7">
        <Alert variant={destructive ? "destructive" : "default"}>
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    </main>
  );
}

async function loadProductsData(selectedProductId?: string): Promise<{
  products: Product[];
  activeProduct: Product | null;
  selectedProduct: Product | null;
  planTier: string | null;
  error: string | null;
  authRequired: boolean;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const productService = new ProductService(supabase);
    const [products, activeProduct, profile] = await Promise.all([
      productService.listProducts(),
      productService.getLatestProduct(),
      supabase.from("users").select("plan_tier").maybeSingle(),
    ]);
    const selectedProduct = selectedProductId
      ? products.find((product) => product.id === selectedProductId) ?? null
      : null;

    return {
      products,
      activeProduct,
      selectedProduct,
      planTier: typeof profile.data?.plan_tier === "string" ? profile.data.plan_tier : "free",
      error: profile.error ? profile.error.message : null,
      authRequired: false,
    };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { products: [], activeProduct: null, selectedProduct: null, planTier: null, error: null, authRequired: true };
    }

    if (error instanceof ProductReadError) {
      return { products: [], activeProduct: null, selectedProduct: null, planTier: null, error: error.message, authRequired: false };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        products: [],
        activeProduct: null,
        selectedProduct: null,
        planTier: null,
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
        authRequired: false,
      };
    }

    throw error;
  }
}
