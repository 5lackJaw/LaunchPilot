import type { SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";
import {
  listOutreachContactsSchema,
  outreachContactSchema,
  requestOutreachDraftGenerationSchema,
  requestProspectIdentificationSchema,
  scheduleOutreachFollowUpSchema,
  sendOutreachEmailSchema,
  suppressOutreachContactSchema,
} from "@/server/schemas/outreach";
import type { OutreachContact } from "@/server/schemas/outreach";
import { ProductService } from "@/server/services/product-service";
import { PlanService } from "@/server/services/plan-service";

const outreachContactSelect =
  "id,product_id,name,email,publication,url,score,status,last_contact_at,provenance,created_at,updated_at";

export class OutreachService {
  constructor(private readonly supabase: SupabaseClient) {}

  async listContacts(input: unknown): Promise<OutreachContact[]> {
    const parsed = listOutreachContactsSchema.parse(input);
    await new ProductService(this.supabase).getProduct({
      productId: parsed.productId,
    });

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
    await new ProductService(this.supabase).getProduct({
      productId: parsed.productId,
    });
    await new PlanService(this.supabase).assertCanUseGeneratedAction({
      productId: parsed.productId,
      actionLabel: "outreach prospect identification",
    });

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
    await new ProductService(this.supabase).getProduct({
      productId: contact.productId,
    });
    await new PlanService(this.supabase).assertCanUseGeneratedAction({
      productId: contact.productId,
      actionLabel: "outreach draft generation",
    });

    if (contact.status === "suppressed") {
      throw new OutreachDraftRequestError(
        "Suppressed contacts cannot request outreach drafts.",
      );
    }

    if (!["identified", "drafted", "failed"].includes(contact.status)) {
      throw new OutreachDraftRequestError(
        "Only identified, drafted, or failed contacts can request outreach drafts.",
      );
    }

    await inngest.send({
      name: "outreach/draft_generation.requested",
      data: {
        contactId: contact.id,
        productId: contact.productId,
      },
    });
  }

  async sendApprovedEmail(input: unknown): Promise<OutreachContact> {
    const parsed = sendOutreachEmailSchema.parse(input);
    const contact = await this.getContact({ contactId: parsed.contactId });
    await new ProductService(this.supabase).getProduct({
      productId: contact.productId,
    });
    await new PlanService(this.supabase).assertCanExecuteAction({
      productId: contact.productId,
      actionLabel: "outreach sending",
    });

    if (contact.status === "suppressed") {
      throw new OutreachSendError(
        "Suppressed contacts cannot receive outreach emails.",
      );
    }

    if (contact.status !== "pending_review" && contact.status !== "drafted") {
      throw new OutreachSendError("Only reviewed outreach drafts can be sent.");
    }

    const sentAt = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("outreach_contacts")
      .update({
        status: "sent",
        last_contact_at: sentAt,
        provenance: {
          ...contact.provenance,
          send: {
            adapter: "outreach-email-simulated-v0",
            sentAt,
            recipient: contact.email,
          },
        },
      })
      .eq("id", contact.id)
      .select(outreachContactSelect)
      .single();

    if (error) {
      throw new OutreachSendError(error.message);
    }

    return mapOutreachContact(data);
  }

  async suppressContact(input: unknown): Promise<OutreachContact> {
    const parsed = suppressOutreachContactSchema.parse(input);
    const contact = await this.getContact({ contactId: parsed.contactId });
    await new ProductService(this.supabase).getProduct({
      productId: contact.productId,
    });

    if (contact.status === "suppressed") {
      throw new OutreachSuppressError("Contact is already suppressed.");
    }

    const suppressedAt = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("outreach_contacts")
      .update({
        status: "suppressed",
        provenance: {
          ...contact.provenance,
          suppression: {
            reason: parsed.reason || null,
            suppressedAt,
            suppressor: "manual",
          },
        },
      })
      .eq("id", contact.id)
      .select(outreachContactSelect)
      .single();

    if (error) {
      throw new OutreachSuppressError(error.message);
    }

    return mapOutreachContact(data);
  }

  async scheduleFollowUp(input: unknown): Promise<OutreachContact> {
    const parsed = scheduleOutreachFollowUpSchema.parse(input);
    const contact = await this.getContact({ contactId: parsed.contactId });
    await new ProductService(this.supabase).getProduct({
      productId: contact.productId,
    });

    if (contact.status === "suppressed") {
      throw new OutreachFollowUpScheduleError(
        "Suppressed contacts cannot have follow-ups scheduled.",
      );
    }

    if (!["sent", "opened"].includes(contact.status)) {
      throw new OutreachFollowUpScheduleError(
        "Only sent or opened outreach contacts can have follow-ups scheduled.",
      );
    }

    const scheduledFor = new Date();
    scheduledFor.setUTCDate(scheduledFor.getUTCDate() + parsed.delayDays);

    const { data, error } = await this.supabase
      .from("outreach_contacts")
      .update({
        provenance: {
          ...contact.provenance,
          followUp: {
            scheduledFor: scheduledFor.toISOString(),
            delayDays: parsed.delayDays,
            scheduler: "outreach-follow-up-scheduler-v0",
            scheduledAt: new Date().toISOString(),
          },
        },
      })
      .eq("id", contact.id)
      .select(outreachContactSelect)
      .single();

    if (error) {
      throw new OutreachFollowUpScheduleError(error.message);
    }

    return mapOutreachContact(data);
  }

  private async getContact(input: {
    contactId: string;
  }): Promise<OutreachContact> {
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

export class OutreachSendError extends Error {
  constructor(message: string) {
    super(`Outreach email could not be sent: ${message}`);
    this.name = "OutreachSendError";
  }
}

export class OutreachSuppressError extends Error {
  constructor(message: string) {
    super(`Outreach contact could not be suppressed: ${message}`);
    this.name = "OutreachSuppressError";
  }
}

export class OutreachFollowUpScheduleError extends Error {
  constructor(message: string) {
    super(`Outreach follow-up could not be scheduled: ${message}`);
    this.name = "OutreachFollowUpScheduleError";
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
