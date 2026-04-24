import { inngest } from "@/inngest/client";

async function main() {
  console.log(`Worker scaffold loaded for ${inngest.id}.`);
  console.log("Durable workflow execution will be added in the relevant implementation slice.");
}

void main();
