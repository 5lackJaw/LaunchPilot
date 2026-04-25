import { serve } from "inngest/next";
import { directoryPackageGenerationWorkflow } from "@/inngest/directory-functions";
import { functions } from "@/inngest/functions";
import { inngest } from "@/inngest/client";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [...functions, directoryPackageGenerationWorkflow],
});
