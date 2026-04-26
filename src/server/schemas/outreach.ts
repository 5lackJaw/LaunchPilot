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

export type OutreachContact = z.infer<typeof outreachContactSchema>;
