import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import {
  fetchBnrExchangeRates,
  getBnrRateForDate,
  getBnrYearRatesMap,
} from "../bnrService";

export const systemRouter = router({
  health: publicProcedure.query(() => {
    return { status: "ok" };
  }),
  getBnrRates: publicProcedure.query(async () => {
    return await fetchBnrExchangeRates();
  }),
  getBnrRateForDate: publicProcedure
    .input(
      z.object({
        date: z.string(),
        currency: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return await getBnrRateForDate(input.date, input.currency || "EUR");
    }),
  getBnrYearRates: publicProcedure
    .input(
      z
        .object({
          year: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const year = input?.year || new Date().getFullYear();
      return await getBnrYearRatesMap(year);
    }),
});

