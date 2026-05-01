import type { User } from "@supabase/supabase-js";
import { env } from "@/config/env";

export function isInternalAdmin(user: User) {
  const ids = parseList(env.INTERNAL_ADMIN_USER_IDS);
  const emails = parseList(env.INTERNAL_ADMIN_EMAILS).map((email) => email.toLowerCase());
  const email = user.email?.toLowerCase();

  return ids.includes(user.id) || Boolean(email && emails.includes(email));
}

export function shouldUseAdminOverride(input: {
  user: User;
  requested: boolean;
}) {
  return input.requested && isInternalAdmin(input.user);
}

function parseList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
