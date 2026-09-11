import { router, publicProcedure } from "./trpc";
import { fetchBnrExchangeRates } from "../bnrService";

export const systemRouter = router({
  health: publicProcedure.query(() => {
    return { status: "ok" };
  }),
  getBnrRates: publicProcedure.query(async () => {
    return await fetchBnrExchangeRates();
  }),
});

