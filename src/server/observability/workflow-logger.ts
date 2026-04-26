import * as Sentry from "@sentry/nextjs";

type WorkflowStatus = "started" | "succeeded" | "failed";

type SafeMetadataValue = boolean | number | string | null | undefined;

type WorkflowLogContext = {
  workflow: string;
  status: WorkflowStatus;
  eventName?: string;
  productId?: string;
  entityId?: string;
  metadata?: Record<string, SafeMetadataValue>;
};

export function logWorkflowEvent(context: WorkflowLogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    subsystem: "workflow",
    ...context,
    metadata: cleanMetadata(context.metadata),
  };

  const message = JSON.stringify(entry);

  if (context.status === "failed") {
    console.error(message);
    return;
  }

  console.info(message);
}

export function captureWorkflowException(error: unknown, context: Omit<WorkflowLogContext, "status">) {
  const errorMessage = error instanceof Error ? error.message : "Unknown workflow failure";

  Sentry.withScope((scope) => {
    scope.setTag("subsystem", "workflow");
    scope.setTag("workflow", context.workflow);
    if (context.eventName) {
      scope.setTag("event_name", context.eventName);
    }
    if (context.productId) {
      scope.setTag("product_id", context.productId);
    }
    if (context.entityId) {
      scope.setTag("entity_id", context.entityId);
    }
    scope.setContext("workflow", {
      workflow: context.workflow,
      eventName: context.eventName,
      productId: context.productId,
      entityId: context.entityId,
      metadata: cleanMetadata(context.metadata),
    });
    Sentry.captureException(error);
  });

  logWorkflowEvent({
    ...context,
    status: "failed",
    metadata: {
      ...context.metadata,
      errorMessage,
    },
  });
}

function cleanMetadata(metadata: WorkflowLogContext["metadata"]) {
  if (!metadata) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  );
}
