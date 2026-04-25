import { inngest } from "@/inngest/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildDirectoryListingPackage } from "@/server/directory/build-listing-package";
import { directorySchema } from "@/server/schemas/directory";
import { marketingBriefSchema } from "@/server/schemas/brief";

export const directoryPackageGenerationWorkflow = inngest.createFunction(
  { id: "directory-package-generation-workflow", triggers: [{ event: "directory_package/generation.requested" }] },
  async ({ event, step }) => {
    const productId = event.data.productId as string;
    const supabase = createSupabaseAdminClient();

    const inputs = await step.run("load-directory-package-inputs", async () => {
      const [productResult, directoriesResult, briefResult] = await Promise.all([
        supabase.from("products").select("id,name,url,current_marketing_brief_id").eq("id", productId).single(),
        supabase
          .from("directories")
          .select("id,name,url,categories,submission_method,avg_da,avg_traffic_tier,review_time_days,free_tier_available,paid_tier_price,active")
          .eq("active", true)
          .order("name", { ascending: true }),
        supabase
          .from("marketing_briefs")
          .select(
            "id,product_id,version,tagline,value_props,personas,competitors,keyword_clusters,tone_profile,channels_ranked,content_calendar_seed,launch_date,provenance,created_at,updated_at",
          )
          .eq("product_id", productId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (productResult.error) {
        throw productResult.error;
      }

      if (directoriesResult.error) {
        throw directoriesResult.error;
      }

      if (briefResult.error) {
        throw briefResult.error;
      }

      return {
        product: productResult.data,
        directories: directoriesResult.data.map((directory) =>
          directorySchema.parse({
            id: directory.id,
            name: directory.name,
            url: directory.url,
            categories: directory.categories,
            submissionMethod: directory.submission_method,
            avgDa: directory.avg_da,
            avgTrafficTier: directory.avg_traffic_tier,
            reviewTimeDays: directory.review_time_days,
            freeTierAvailable: directory.free_tier_available,
            paidTierPrice: directory.paid_tier_price,
            active: directory.active,
          }),
        ),
        brief: briefResult.data
          ? marketingBriefSchema.parse({
              id: briefResult.data.id,
              productId: briefResult.data.product_id,
              version: briefResult.data.version,
              tagline: briefResult.data.tagline,
              valueProps: briefResult.data.value_props,
              personas: briefResult.data.personas,
              competitors: briefResult.data.competitors,
              keywordClusters: briefResult.data.keyword_clusters,
              toneProfile: briefResult.data.tone_profile,
              channelsRanked: briefResult.data.channels_ranked,
              contentCalendarSeed: briefResult.data.content_calendar_seed,
              launchDate: briefResult.data.launch_date,
              provenance: briefResult.data.provenance,
              createdAt: briefResult.data.created_at,
              updatedAt: briefResult.data.updated_at,
            })
          : null,
      };
    });

    const submissions = await step.run("persist-listing-packages", async () => {
      const rows = inputs.directories.map((directory) => ({
        product_id: productId,
        directory_id: directory.id,
        status: "pending",
        listing_payload: buildDirectoryListingPackage({
          productName: inputs.product.name,
          productUrl: inputs.product.url,
          directory,
          brief: inputs.brief,
        }),
        provenance: {
          generator: "deterministic-directory-package-v0",
          generatedAt: new Date().toISOString(),
          briefVersion: inputs.brief?.version ?? null,
        },
      }));

      const { data, error } = await supabase
        .from("directory_submissions")
        .upsert(rows, { onConflict: "product_id,directory_id" })
        .select("id,product_id,directory_id,listing_payload");

      if (error) {
        throw error;
      }

      return data;
    });

    await step.run("create-directory-review-items", async () => {
      for (const submission of submissions) {
        const directory = inputs.directories.find((item) => item.id === submission.directory_id);
        const payload = submission.listing_payload as { productName?: string; tagline?: string; shortDescription?: string };

        const existing = await supabase
          .from("inbox_items")
          .select("id")
          .eq("product_id", productId)
          .eq("source_entity_type", "directory_submission")
          .eq("source_entity_id", submission.id)
          .eq("status", "pending")
          .maybeSingle();

        if (existing.error) {
          throw existing.error;
        }

        if (existing.data) {
          continue;
        }

        const itemResult = await supabase
          .from("inbox_items")
          .insert({
            product_id: productId,
            item_type: "directory_package",
            source_entity_type: "directory_submission",
            source_entity_id: submission.id,
            payload: {
              title: `${directory?.name ?? "Directory"} listing package ready`,
              preview: payload.shortDescription ?? payload.tagline ?? "Review this directory listing package.",
              body: JSON.stringify(submission.listing_payload, null, 2),
              suggestedAction: "Review the listing package before submission.",
              metadata: { directoryId: submission.directory_id, directoryName: directory?.name },
            },
            ai_confidence: 0.84,
            impact_estimate: directory?.avgTrafficTier === "high" ? "high" : "medium",
            review_time_estimate_seconds: 420,
          })
          .select("id,product_id")
          .single();

        if (itemResult.error) {
          throw itemResult.error;
        }

        const eventResult = await supabase.from("inbox_item_events").insert({
          inbox_item_id: itemResult.data.id,
          product_id: itemResult.data.product_id,
          event_type: "created",
          metadata: {
            sourceEntityType: "directory_submission",
            sourceEntityId: submission.id,
            workflow: "directory_package_generation",
          },
        });

        if (eventResult.error) {
          throw eventResult.error;
        }
      }

      return { createdFor: submissions.length };
    });
  },
);
