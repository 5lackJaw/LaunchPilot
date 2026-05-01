import { WorkflowStatusRefresh } from "@/components/workflow-status-refresh";

export function CrawlStatusRefresh({ enabled }: { enabled: boolean }) {
  return <WorkflowStatusRefresh enabled={enabled} />;
}
