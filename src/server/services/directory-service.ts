import type { SupabaseClient } from "@supabase/supabase-js";
import { directorySchema, directorySubmissionSchema, listDirectoryTrackerSchema } from "@/server/schemas/directory";
import type { Directory, DirectorySubmission, DirectoryTrackerItem } from "@/server/schemas/directory";
import { ProductService } from "@/server/services/product-service";

const directorySelect =
  "id,name,url,categories,submission_method,avg_da,avg_traffic_tier,review_time_days,free_tier_available,paid_tier_price,active";
const submissionSelect =
  "id,product_id,directory_id,status,listing_payload,submitted_at,live_url,notes,provenance,created_at,updated_at";

export class DirectoryService {
  constructor(private readonly supabase: SupabaseClient) {}

  async listTracker(input: unknown): Promise<DirectoryTrackerItem[]> {
    const parsed = listDirectoryTrackerSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId: parsed.productId });

    const [directoriesResult, submissionsResult] = await Promise.all([
      this.supabase.from("directories").select(directorySelect).eq("active", true).order("name", { ascending: true }),
      this.supabase.from("directory_submissions").select(submissionSelect).eq("product_id", parsed.productId),
    ]);

    if (directoriesResult.error) {
      throw new DirectoryReadError(directoriesResult.error.message);
    }

    if (submissionsResult.error) {
      throw new DirectoryReadError(submissionsResult.error.message);
    }

    const submissionsByDirectory = new Map(
      (submissionsResult.data ?? []).map((submission) => [submission.directory_id, mapSubmission(submission)]),
    );

    return (directoriesResult.data ?? []).map((directory) => ({
      directory: mapDirectory(directory),
      submission: submissionsByDirectory.get(directory.id) ?? null,
    }));
  }
}

export class DirectoryReadError extends Error {
  constructor(message: string) {
    super(`Directory tracker could not be loaded: ${message}`);
    this.name = "DirectoryReadError";
  }
}

function mapDirectory(data: {
  id: string;
  name: string;
  url: string;
  categories: string[];
  submission_method: string;
  avg_da: number | null;
  avg_traffic_tier: string;
  review_time_days: number | null;
  free_tier_available: boolean;
  paid_tier_price: number | null;
  active: boolean;
}): Directory {
  return directorySchema.parse({
    id: data.id,
    name: data.name,
    url: data.url,
    categories: data.categories,
    submissionMethod: data.submission_method,
    avgDa: data.avg_da,
    avgTrafficTier: data.avg_traffic_tier,
    reviewTimeDays: data.review_time_days,
    freeTierAvailable: data.free_tier_available,
    paidTierPrice: data.paid_tier_price,
    active: data.active,
  });
}

function mapSubmission(data: {
  id: string;
  product_id: string;
  directory_id: string;
  status: string;
  listing_payload: unknown;
  submitted_at: string | null;
  live_url: string | null;
  notes: string | null;
  provenance: unknown;
  created_at: string;
  updated_at: string;
}): DirectorySubmission {
  return directorySubmissionSchema.parse({
    id: data.id,
    productId: data.product_id,
    directoryId: data.directory_id,
    status: data.status,
    listingPayload: data.listing_payload,
    submittedAt: data.submitted_at,
    liveUrl: data.live_url,
    notes: data.notes,
    provenance: data.provenance,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });
}
