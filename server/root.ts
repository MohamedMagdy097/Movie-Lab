import { createRouter } from "./trpc";

/**
 * Root API Router
 */
export const appRouter = createRouter({
});

export type AppRouter = typeof appRouter;
