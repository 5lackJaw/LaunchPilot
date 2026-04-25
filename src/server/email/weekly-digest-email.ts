import { env } from "@/config/env";
import type { WeeklyBrief } from "@/server/schemas/analytics";

export function isWeeklyDigestEmailConfigured() {
  return Boolean(env.RESEND_API_KEY && env.WEEKLY_DIGEST_FROM_EMAIL);
}

export async function sendWeeklyDigestEmail(input: { to: string; productName: string; brief: WeeklyBrief }) {
  if (!env.RESEND_API_KEY || !env.WEEKLY_DIGEST_FROM_EMAIL) {
    throw new WeeklyDigestEmailError("Weekly digest email is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.WEEKLY_DIGEST_FROM_EMAIL,
      to: input.to,
      subject: `${input.productName} weekly digest`,
      text: input.brief.summaryMd,
      html: renderDigestHtml(input.brief),
    }),
  });

  if (!response.ok) {
    throw new WeeklyDigestEmailError(`Resend returned ${response.status}: ${await response.text()}`);
  }
}

export class WeeklyDigestEmailError extends Error {
  constructor(message: string) {
    super(`Weekly digest email could not be sent: ${message}`);
    this.name = "WeeklyDigestEmailError";
  }
}

function renderDigestHtml(brief: WeeklyBrief) {
  const paragraphs = brief.summaryMd
    .split("\n")
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");

  return `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#111">${paragraphs}</body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
