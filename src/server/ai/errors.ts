import type { AiTaskClass } from "@/server/ai/types";

export class AiConfigurationError extends Error {
  constructor(message: string) {
    super(`AI provider is not configured: ${message}`);
    this.name = "AiConfigurationError";
  }
}

export class AiBudgetExceededError extends Error {
  constructor(input: {
    taskClass: AiTaskClass;
    hardBudgetUsd: number;
    usedUsd: number;
    estimatedCostUsd: number;
  }) {
    super(
      `AI budget limit reached for ${input.taskClass}. Hard cap is $${input.hardBudgetUsd.toFixed(
        2,
      )}; current usage is $${input.usedUsd.toFixed(
        4,
      )}; estimated request cost is $${input.estimatedCostUsd.toFixed(4)}.`,
    );
    this.name = "AiBudgetExceededError";
  }
}

export class AiGenerationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(`AI generation failed: ${message}`, options);
    this.name = "AiGenerationError";
  }
}
