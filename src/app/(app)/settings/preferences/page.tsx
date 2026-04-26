import { AppTopbar } from "@/components/layout/app-topbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateAutomationPreferenceAction } from "@/app/(app)/settings/preferences/actions";
import type { AutomationPreference } from "@/server/schemas/preferences";
import type { Product } from "@/server/schemas/product";
import { AuthRequiredError } from "@/server/services/auth-service";
import { PreferencesReadError, PreferencesService } from "@/server/services/preferences-service";
import { ProductReadError, ProductService } from "@/server/services/product-service";

type PageProps = {
  searchParams: Promise<{
    updated?: string;
    preferenceError?: string;
  }>;
};

const trustLevels = [
  { value: 1, label: "Level 1", description: "Review every action before execution." },
  { value: 2, label: "Level 2", description: "Auto-execute only very safe low-risk actions." },
  { value: 3, label: "Level 3", description: "Allow broader autopilot within server guardrails." },
] as const;

export default async function PreferencesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await loadPreferencesData();
  const product = data.product;

  return (
    <main className="flex min-h-screen flex-col">
      <AppTopbar
        title="Settings"
        eyebrow={data.product ? `Preferences / ${data.product.name}` : "Preferences"}
        actions={<Badge variant="secondary">{data.preferences.length} channels</Badge>}
      />

      <section className="grid gap-4 p-6 xl:grid-cols-[1fr_340px]">
        {params.updated ? (
          <Alert className="xl:col-span-2">
            <AlertTitle>Preference saved</AlertTitle>
            <AlertDescription>The {params.updated} automation setting is now active for this product.</AlertDescription>
          </Alert>
        ) : null}
        {params.preferenceError || data.error ? (
          <Alert variant="destructive" className="xl:col-span-2">
            <AlertTitle>Preferences could not be loaded</AlertTitle>
            <AlertDescription>{data.error ?? params.preferenceError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4">
          {product ? (
            data.preferences.map((preference) => <PreferenceCard key={preference.channel} product={product} preference={preference} />)
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No product found</CardTitle>
                <CardDescription>Create a product before setting automation preferences.</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Server guardrails</CardTitle>
              <CardDescription>Trust levels never move authority into the browser.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Low-confidence outputs stay review-gated.</p>
              <p>Community replies with high promotional risk are blocked.</p>
              <p>External credentials remain server-only when provider posting is added.</p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}

function PreferenceCard({ product, preference }: { product: Product; preference: AutomationPreference }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="capitalize">{preference.channel}</CardTitle>
            <CardDescription>{channelDescription(preference.channel)}</CardDescription>
          </div>
          <Badge variant={preference.trustLevel === 1 ? "secondary" : "warning"}>Level {preference.trustLevel}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form action={updateAutomationPreferenceAction} className="grid gap-4 lg:grid-cols-[1fr_140px_140px_auto] lg:items-end">
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="channel" value={preference.channel} />
          <fieldset className="grid gap-2">
            <legend className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Trust level</legend>
            <div className="grid gap-2 md:grid-cols-3">
              {trustLevels.map((level) => (
                <label key={level.value} className="rounded-md border bg-secondary p-3 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <input type="radio" name="trustLevel" value={level.value} defaultChecked={preference.trustLevel === level.value} />
                    {level.label}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">{level.description}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <NumberField label="Daily limit" name="dailyAutoActionLimit" value={preference.dailyAutoActionLimit} min={0} max={50} />
          <NumberField label="Review window" name="reviewWindowHours" value={preference.reviewWindowHours} min={0} max={168} />
          <Button type="submit" size="sm">
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function NumberField({ label, name, value, min, max }: { label: string; name: string; value: number; min: number; max: number }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <input
        name={name}
        type="number"
        min={min}
        max={max}
        defaultValue={value}
        className="h-9 rounded-md border bg-background px-2 font-mono text-sm text-foreground"
      />
    </label>
  );
}

function channelDescription(channel: AutomationPreference["channel"]) {
  const descriptions: Record<AutomationPreference["channel"], string> = {
    content: "Publishing and content execution preferences.",
    community: "Reply drafting, approval, and safe auto-post eligibility.",
    directories: "Listing package submission preferences.",
    outreach: "Prospect email and follow-up preferences.",
  };

  return descriptions[channel];
}

async function loadPreferencesData(): Promise<{
  product: Product | null;
  preferences: AutomationPreference[];
  error: string | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const product = await new ProductService(supabase).getLatestProduct();

    if (!product) {
      return { product: null, preferences: [], error: null };
    }

    const preferences = await new PreferencesService(supabase).listAutomationPreferences({ productId: product.id });
    return { product, preferences, error: null };
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return { product: null, preferences: [], error: error.message };
    }

    if (error instanceof ProductReadError || error instanceof PreferencesReadError) {
      return { product: null, preferences: [], error: error.message };
    }

    if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
      return {
        product: null,
        preferences: [],
        error: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
      };
    }

    throw error;
  }
}
