import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { authenticateAccount, createAccount, getAccountByEmail } from "./auth";
import { createSessionToken, extractTokenFromHeader } from "./session";
import { getAccountById } from "./auth";

export const authRouter = router({
  /**
   * Register a new account
   */
  register: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8),
      confirmPassword: z.string(),
    }))
    .mutation(async ({ input }) => {
      if (input.password !== input.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      // Check if email already exists
      const existing = await getAccountByEmail(input.email);
      if (existing) {
        throw new Error("Email already registered");
      }

      // Create account
      await createAccount(input.email, input.password, undefined, "user");

      // Authenticate and return token
      const account = await authenticateAccount(input.email, input.password);
      const token = await createSessionToken({
        accountId: account.id,
        email: account.email,
        role: account.role,
        tenantId: account.tenantId || undefined,
      });

      return {
        success: true,
        token,
        account: {
          id: account.id,
          email: account.email,
          role: account.role,
          tenantId: account.tenantId,
        },
      };
    }),

  /**
   * Login with email and password
   */
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const account = await authenticateAccount(input.email, input.password);

        const token = await createSessionToken({
          accountId: account.id,
          email: account.email,
          role: account.role,
          tenantId: account.tenantId || undefined,
        });

        return {
          success: true,
          token,
          account: {
            id: account.id,
            email: account.email,
            role: account.role,
            tenantId: account.tenantId,
          },
        };
      } catch (error) {
        throw new Error("Invalid email or password");
      }
    }),

  /**
   * Get current account info
   */
  me: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user) return null;

      // For now, return user info from context
      // In a real app, you'd fetch from database
      return {
        id: ctx.user.id,
        email: ctx.user.email,
        role: ctx.user.role,
      };
    }),

  /**
   * Logout (client-side only, just clear token)
   */
  logout: publicProcedure
    .mutation(() => {
      return { success: true };
    }),
});
