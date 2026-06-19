import { router, publicProcedure } from "./trpc";

export const systemRouter = router({
  health: publicProcedure.query(() => {
    return { status: "ok" };
  }),
});
