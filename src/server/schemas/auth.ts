import { z } from "zod";

export const emailPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(320, "Email is too long."),
  password: z.string().min(8, "Use at least 8 characters.").max(128, "Password is too long."),
});

export type EmailPasswordInput = z.infer<typeof emailPasswordSchema>;
