import { serve } from "inngest/next";
import { communityReplyGenerationWorkflow, communityThreadIngestionWorkflow } from "@/inngest/community-functions";
import { directoryPackageGenerationWorkflow } from "@/inngest/directory-functions";
import { functions } from "@/inngest/functions";
import { inngest } from "@/inngest/client";
import { prospectIdentificationWorkflow } from "@/inngest/outreach-functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [...functions, directoryPackageGenerationWorkflow, communityThreadIngestionWorkflow, communityReplyGenerationWorkflow, prospectIdentificationWorkflow],
});
