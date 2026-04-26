import { inngest } from "@/inngest/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildOutreachDraft } from "@/server/outreach/build-outreach-draft";
import { buildProspectCandidates } from "@/server/outreach/build-prospect-candidates";
import { marketingBriefSchema } from "@/server/schemas/brief";
import { outreachContactSchema } from "@/server/schemas/outreach";

export const prospectIdentificationWorkflow = inngest.createFunction(
  { id: "prospect-identification-workflow", triggers: [{ event: "outreach/prospect_identification.requested" }] },
  async ({ event, step }) => {
    const productId = event.data.productId as string;
    const supabase = createSupabaseAdminClient();

    const inputs = await step.run("load-outreach-inputs", async () => {
      const productResult = await supabase.from("products").select("id,name,url,current_marketing_brief_id").eq("id", productId).single();

      if (productResult.error) {
        throw productResult.error;
      }

      if (!productResult.data.current_marketing_brief_id) {
        throw new Error("A Marketing Brief is required before prospect identification.");
      }

      const briefResult = await supabase
        .from("marketing_briefs")
        .select(
          "id,product_id,version,tagline,value_props,personas,competitors,keyword_clusters,tone_profile,channels_ranked,content_calendar_seed,launch_date,provenance,created_at,updated_at",
        )
        .eq("id", productResult.data.current_marketing_brief_id)
        .single();

      if (briefResult.error) {
        throw briefResult.error;
      }

      return {
        product: productResult.data,
        brief: marketingBriefSchema.parse({
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
        }),
      };
    });

    const candidates = await step.run("identify-prospect-candidates", async () =>
      buildProspectCandidates({
        productName: inputs.product.name,
        productUrl: inputs.product.url,
        brief: inputs.brief,
      }),
    );

    await step.run("persist-identified-prospects", async () => {
      const rows = candidates.map((candidate) => ({
        product_id: productId,
        name: candidate.name,
        email: candidate.email,
        publication: candidate.publication,
        url: candidate.url,
        score: candidate.score,
        status: "identified",
        provenance: candidate.provenance,
      }));

      const { error } = await supabase.from("outreach_contacts").upsert(rows, { onConflict: "product_id,url" });

      if (error) {
        throw error;
      }

      return rows.length;
    });
  },
);

export const outreachDraftGenerationWorkflow = inngest.createFunction(
  { id: "outreach-draft-generation-workflow", triggers: [{ event: "outreach/draft_generation.requested" }] },
  async ({ event, step }) => {
    const contactId = event.data.contactId as string;
    const supabase = createSupabaseAdminClient();

    const inputs = await step.run("load-draft-inputs", async () => {
      const contactResult = await supabase
        .from("outreach_contacts")
        .select("id,product_id,name,email,publication,url,score,status,last_contact_at,provenance,created_at,updated_at")
        .eq("id", contactId)
        .single();

      if (contactResult.error) {
        throw contactResult.error;
      }

      const contact = outreachContactSchema.parse({
        id: contactResult.data.id,
        productId: contactResult.data.product_id,
        name: contactResult.data.name,
        email: contactResult.data.email,
        publication: contactResult.data.publication,
        url: contactResult.data.url,
        score: Number(contactResult.data.score),
        status: contactResult.data.status,
        lastContactAt: contactResult.data.last_contact_at,
        provenance: contactResult.data.provenance,
        createdAt: contactResult.data.created_at,
        updatedAt: contactResult.data.updated_at,
      });

      if (!["identified", "drafted", "failed"].includes(contact.status)) {
        throw new Error("Outreach contact is not eligible for draft generation.");
      }

      const productResult = await supabase.from("products").select("id,name,url,current_marketing_brief_id").eq("id", contact.productId).single();

      if (productResult.error) {
        throw productResult.error;
      }

      if (!productResult.data.current_marketing_brief_id) {
        throw new Error("A Marketing Brief is required before outreach draft generation.");
      }

      const briefResult = await supabase
        .from("marketing_briefs")
        .select(
          "id,product_id,version,tagline,value_props,personas,competitors,keyword_clusters,tone_profile,channels_ranked,content_calendar_seed,launch_date,provenance,created_at,updated_at",
        )
        .eq("id", productResult.data.current_marketing_brief_id)
        .single();

      if (briefResult.error) {
        throw briefResult.error;
      }

      return {
        contact,
        product: productResult.data,
        brief: marketingBriefSchema.parse({
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
        }),
      };
    });

    const draft = await step.run("compose-outreach-draft", async () =>
      buildOutreachDraft({
        productName: inputs.product.name,
        productUrl: inputs.product.url,
        brief: inputs.brief,
        contact: inputs.contact,
      }),
    );

    const updated = await step.run("mark-contact-pending-review", async () => {
      const { data, error } = await supabase
        .from("outreach_contacts")
        .update({
          status: "pending_review",
          provenance: {
            ...inputs.contact.provenance,
            outreachDraft: {
              generator: "deterministic-outreach-draft-v0",
              generatedAt: new Date().toISOString(),
              rationale: draft.rationale,
              confidence: draft.confidence,
            },
          },
        })
        .eq("id", inputs.contact.id)
        .select("id,product_id,name,email,publication,url,score,status")
        .single();

      if (error) {
        throw error;
      }

      return data;
    });

    await step.run("create-outreach-inbox-item", async () => {
      const existing = await supabase
        .from("inbox_items")
        .select("id")
        .eq("product_id", updated.product_id)
        .eq("source_entity_type", "outreach_contact")
        .eq("source_entity_id", updated.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existing.error) {
        throw existing.error;
      }

      if (existing.data) {
        return existing.data;
      }

      const itemResult = await supabase
        .from("inbox_items")
        .insert({
          product_id: updated.product_id,
          item_type: "outreach_email",
          source_entity_type: "outreach_contact",
          source_entity_id: updated.id,
          payload: {
            title: `Outreach draft for ${updated.name}`,
            preview: `${updated.publication ?? "Prospect"} outreach draft. Score ${Math.round(Number(updated.score) * 100)}%.`,
            body: draft.body,
            recipient: updated.name,
            publication: updated.publication,
            subject: draft.subject,
            suggestedAction: "Review the outreach email before sending.",
            metadata: {
              contactUrl: updated.url,
              email: updated.email,
              contactScore: Number(updated.score),
            },
          },
          ai_confidence: draft.confidence,
          impact_estimate: Number(updated.score) >= 0.82 ? "high" : "medium",
          review_time_estimate_seconds: 240,
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
        metadata: { sourceEntityType: "outreach_contact", sourceEntityId: updated.id, workflow: "outreach_draft_generation" },
      });

      if (eventResult.error) {
        throw eventResult.error;
      }

      return itemResult.data;
    });
  },
);
