import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TRPCContext } from "@/server/trpc/context";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const appRouter = createTRPCRouter({
  health: publicProcedure.query(() => ({ ok: true })),
});

export type AppRouter = typeof appRouter;
