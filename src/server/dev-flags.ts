import { env } from "@/config/env";

export function isDevInboxSeedEnabled() {
  return process.env.NODE_ENV !== "production" && env.ENABLE_DEV_INBOX_SEED === "1";
}
