export type ContentGenerationProvenance = {
  status: "queued" | "running" | "completed" | "failed";
  progressPercent: number;
  steps: Array<{ label: string; status: "pending" | "running" | "completed" | "failed" }>;
  requestedAt?: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
};

export function getContentGenerationState(provenance: Record<string, unknown>) {
  const generation = provenance.generation;
  if (!generation || typeof generation !== "object" || Array.isArray(generation)) {
    return null;
  }

  const status = (generation as Record<string, unknown>).status;
  if (status !== "queued" && status !== "running" && status !== "completed" && status !== "failed") {
    return null;
  }

  return generation as ContentGenerationProvenance;
}

export function buildContentGenerationSteps(activeLabel: string): ContentGenerationProvenance["steps"] {
  const labels = [
    "Research search intent",
    "Generate article outline",
    "Draft full article",
    "Review SEO metadata",
    "Create review item",
  ];

  const activeIndex = labels.indexOf(activeLabel);
  return labels.map((label, index) => ({
    label,
    status:
      activeIndex < 0
        ? "pending"
        : index < activeIndex
          ? "completed"
          : index === activeIndex
            ? "running"
            : "pending",
  }));
}

export function completeContentGenerationSteps(): ContentGenerationProvenance["steps"] {
  return buildContentGenerationSteps("").map((step) => ({ ...step, status: "completed" }));
}

