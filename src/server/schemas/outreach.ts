import { z } from "zod";

export const outreachContactStatusSchema = z.enum([
  "identified",
  "drafted",
  "pending_review",
  "sent",
  "opened",
  "replied",
  "converted",
  "suppressed",
  "failed",
]);

export const outreachContactSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable(),
  publication: z.string().nullable(),
  url: z.string().nullable(),
  score: z.number().min(0).max(1),
  status: outreachContactStatusSchema,
  lastContactAt: z.string().nullable(),
  provenance: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const listOutreachContactsSchema = z.object({
  productId: z.string().uuid(),
  status: outreachContactStatusSchema.optional(),
});

export const requestProspectIdentificationSchema = z.object({
  productId: z.string().uuid(),
});

export const requestOutreachDraftGenerationSchema = z.object({
  contactId: z.string().uuid(),
});

export const sendOutreachEmailSchema = z.object({
  contactId: z.string().uuid(),
});

export const scheduleOutreachFollowUpSchema = z.object({
  contactId: z.string().uuid(),
  delayDays: z.coerce.number().int().min(1).max(30).default(5),
});

export type OutreachContact = z.infer<typeof outreachContactSchema>;
