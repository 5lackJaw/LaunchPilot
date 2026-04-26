import type { SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";
import {
  listOutreachContactsSchema,
  outreachContactSchema,
  requestOutreachDraftGenerationSchema,
  requestProspectIdentificationSchema,
} from "@/server/schemas/outreach";
import type { OutreachContact } from "@/server/schemas/outreach";
import { ProductService } from "@/server/services/product-service";

const outreachContactSelect = "id,product_id,name,email,publication,url,score,status,last_contact_at,provenance,created_at,updated_at";

export class OutreachService {
  constructor(private readonly supabase: SupabaseClient) {}

  async listContacts(input: unknown): Promise<OutreachContact[]> {
    const parsed = listOutreachContactsSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId: parsed.productId });

    let query = this.supabase
      .from("outreach_contacts")
      .select(outreachContactSelect)
      .eq("product_id", parsed.productId)
      .order("score", { ascending: false })
      .order("created_at", { ascending: false });

    if (parsed.status) {
      query = query.eq("status", parsed.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new OutreachContactReadError(error.message);
    }

    return data.map(mapOutreachContact);
  }

  async requestProspectIdentification(input: unknown) {
    const parsed = requestProspectIdentificationSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId: parsed.productId });

    await inngest.send({
      name: "outreach/prospect_identification.requested",
      data: {
        productId: parsed.productId,
      },
    });
  }

  async requestDraftGeneration(input: unknown) {
    const parsed = requestOutreachDraftGenerationSchema.parse(input);
    const contact = await this.getContact({ contactId: parsed.contactId });
    await new ProductService(this.supabase).getProduct({ productId: contact.productId });

    if (!["identified", "drafted", "failed"].includes(contact.status)) {
      throw new OutreachDraftRequestError("Only identified, drafted, or failed contacts can request outreach drafts.");
    }

    await inngest.send({
      name: "outreach/draft_generation.requested",
      data: {
        contactId: contact.id,
        productId: contact.productId,
      },
    });
  }

  private async getContact(input: { contactId: string }): Promise<OutreachContact> {
    const { data, error } = await this.supabase
      .from("outreach_contacts")
      .select(outreachContactSelect)
      .eq("id", input.contactId)
      .single();

    if (error) {
      throw new OutreachContactReadError(error.message);
    }

    return mapOutreachContact(data);
  }
}

export class OutreachContactReadError extends Error {
  constructor(message: string) {
    super(`Outreach contacts could not be loaded: ${message}`);
    this.name = "OutreachContactReadError";
  }
}

export class OutreachProspectRequestError extends Error {
  constructor(message: string) {
    super(`Prospect identification could not be requested: ${message}`);
    this.name = "OutreachProspectRequestError";
  }
}

export class OutreachDraftRequestError extends Error {
  constructor(message: string) {
    super(`Outreach draft could not be requested: ${message}`);
    this.name = "OutreachDraftRequestError";
  }
}

function mapOutreachContact(data: {
  id: string;
  product_id: string;
  name: string;
  email: string | null;
  publication: string | null;
  url: string | null;
  score: number | string;
  status: string;
  last_contact_at: string | null;
  provenance: unknown;
  created_at: string;
  updated_at: string;
}) {
  return outreachContactSchema.parse({
    id: data.id,
    productId: data.product_id,
    name: data.name,
    email: data.email,
    publication: data.publication,
    url: data.url,
    score: Number(data.score),
    status: data.status,
    lastContactAt: data.last_contact_at,
    provenance: data.provenance,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}
