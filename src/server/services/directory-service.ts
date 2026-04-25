import type { SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";
import {
  autoSubmitDirectorySubmissionSchema,
  directorySchema,
  directorySubmissionSchema,
  listDirectoryTrackerSchema,
  requestDirectoryPackageGenerationSchema,
  updateDirectorySubmissionStatusSchema,
} from "@/server/schemas/directory";
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

  async requestPackageGeneration(input: unknown) {
    const parsed = requestDirectoryPackageGenerationSchema.parse(input);
    await new ProductService(this.supabase).getProduct({ productId: parsed.productId });

    await inngest.send({
      name: "directory_package/generation.requested",
      data: {
        productId: parsed.productId,
      },
    });
  }

  async updateSubmissionStatus(input: unknown): Promise<DirectorySubmission> {
    const parsed = updateDirectorySubmissionStatusSchema.parse(input);
    const current = await this.getSubmission({ submissionId: parsed.submissionId });
    await new ProductService(this.supabase).getProduct({ productId: current.productId });
    assertAllowedSubmissionTransition(current.status, parsed.status);
    const submittedAt =
      parsed.status === "submitted" || (parsed.status === "live" && !current.submittedAt)
        ? new Date().toISOString()
        : current.submittedAt;

    const { data, error } = await this.supabase
      .from("directory_submissions")
      .update({
        status: parsed.status,
        submitted_at: submittedAt,
        notes: parsed.notes ?? current.notes,
      })
      .eq("id", parsed.submissionId)
      .select(submissionSelect)
      .single();

    if (error) {
      throw new DirectoryUpdateError(error.message);
    }

    return mapSubmission(data);
  }

  async autoSubmitSupported(input: unknown): Promise<DirectorySubmission> {
    const parsed = autoSubmitDirectorySubmissionSchema.parse(input);
    const current = await this.getSubmission({ submissionId: parsed.submissionId });
    await new ProductService(this.supabase).getProduct({ productId: current.productId });
    const directory = await this.getDirectory({ directoryId: current.directoryId });

    if (directory.submissionMethod !== "auto_supported") {
      throw new DirectoryUpdateError("This directory does not support automatic submission.");
    }

    if (current.status !== "pending") {
      throw new DirectoryUpdateError("Only pending directory submissions can be auto-submitted.");
    }

    if (!Object.keys(current.listingPayload).length) {
      throw new DirectoryUpdateError("Generate a listing package before auto-submitting.");
    }

    const submittedAt = new Date().toISOString();
    const provenance = {
      ...current.provenance,
      autoSubmit: {
        adapter: "directory-auto-submit-v0",
        submittedAt,
        directoryName: directory.name,
      },
    };

    const { data, error } = await this.supabase
      .from("directory_submissions")
      .update({
        status: "submitted",
        submitted_at: submittedAt,
        notes: current.notes ?? `Auto-submitted to ${directory.name}.`,
        provenance,
      })
      .eq("id", parsed.submissionId)
      .select(submissionSelect)
      .single();

    if (error) {
      throw new DirectoryUpdateError(error.message);
    }

    return mapSubmission(data);
  }

  private async getSubmission(input: { submissionId: string }): Promise<DirectorySubmission> {
    const { data, error } = await this.supabase
      .from("directory_submissions")
      .select(submissionSelect)
      .eq("id", input.submissionId)
      .single();

    if (error) {
      throw new DirectoryReadError(error.message);
    }

    return mapSubmission(data);
  }

  private async getDirectory(input: { directoryId: string }): Promise<Directory> {
    const { data, error } = await this.supabase.from("directories").select(directorySelect).eq("id", input.directoryId).single();

    if (error) {
      throw new DirectoryReadError(error.message);
    }

    return mapDirectory(data);
  }
}

export class DirectoryReadError extends Error {
  constructor(message: string) {
    super(`Directory tracker could not be loaded: ${message}`);
    this.name = "DirectoryReadError";
  }
}

export class DirectoryUpdateError extends Error {
  constructor(message: string) {
    super(`Directory submission could not be updated: ${message}`);
    this.name = "DirectoryUpdateError";
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

function assertAllowedSubmissionTransition(current: DirectorySubmission["status"], next: DirectorySubmission["status"]) {
  const allowed: Record<DirectorySubmission["status"], DirectorySubmission["status"][]> = {
    pending: ["submitted", "skipped", "failed"],
    submitted: ["live", "rejected", "failed"],
    live: [],
    rejected: ["pending"],
    skipped: ["pending"],
    failed: ["pending"],
  };

  if (!allowed[current].includes(next)) {
    throw new DirectoryUpdateError(`Cannot move a directory submission from ${current} to ${next}.`);
  }
}
