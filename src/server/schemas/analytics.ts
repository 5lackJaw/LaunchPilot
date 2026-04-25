import { z } from "zod";

export const analyticsPeriodSchema = z.object({
  startsAt: z.string(),
  endsAt: z.string(),
  label: z.string(),
});

export const trafficSourceBreakdownSchema = z.object({
  sourceType: z.string(),
  visits: z.number().int().min(0),
  conversions: z.number().int().min(0),
  sharePercent: z.number().min(0).max(100),
});

export const keywordMovementSchema = z.object({
  keyword: z.string(),
  currentPosition: z.number().int().positive(),
  previousPosition: z.number().int().positive().nullable(),
  change: z.number().int().nullable(),
  trend: z.enum(["up", "down", "flat", "new"]),
  source: z.string(),
  recordedAt: z.string(),
});

export const contentPerformanceSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  type: z.string(),
  status: z.string(),
  targetKeyword: z.string().nullable(),
  publishedUrl: z.string().nullable(),
  visits: z.number().int().min(0),
  conversions: z.number().int().min(0),
  currentPosition: z.number().int().positive().nullable(),
  rankChange: z.number().int().nullable(),
  createdAt: z.string(),
});

export const dashboardSummarySchema = z.object({
  productId: z.string().uuid(),
  currentPeriod: analyticsPeriodSchema,
  previousPeriod: analyticsPeriodSchema,
  visitors: z.number().int().min(0),
  visitorDeltaPercent: z.number().int().nullable(),
  conversions: z.number().int().min(0),
  conversionDeltaPercent: z.number().int().nullable(),
  publishedAssets: z.number().int().min(0),
  publishedAssetDelta: z.number().int(),
  pendingInboxItems: z.number().int().min(0),
  estimatedReviewMinutes: z.number().int().min(0),
  sourceBreakdown: z.array(trafficSourceBreakdownSchema),
  keywordMovement: z.array(keywordMovementSchema),
  contentPerformance: z.array(contentPerformanceSchema),
  weeklyInsight: z.object({
    title: z.string(),
    body: z.string(),
    actionLabel: z.string().nullable(),
  }),
});

export const listAnalyticsSchema = z.object({
  productId: z.string().uuid(),
});

export type TrafficSourceBreakdown = z.infer<typeof trafficSourceBreakdownSchema>;
export type KeywordMovement = z.infer<typeof keywordMovementSchema>;
export type ContentPerformance = z.infer<typeof contentPerformanceSchema>;
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
