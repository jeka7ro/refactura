import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { authenticateAccount, createAccount, getAccountByEmail, generatePasswordResetToken, resetPasswordWithToken, changePassword, createGoogleAccount, getAccountById } from "./auth";
import { createSessionToken, extractTokenFromHeader } from "./session";
import { Resend } from "resend";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key_to_prevent_crash_on_boot");
const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

export const authRouter = router({
  /**
   * Register a new account
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        confirmPassword: z.string(),
        phone: z.string().optional(),
      })
    )
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
      await createAccount(input.email, input.password, undefined, "user", input.phone);

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
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
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
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user;
    if (!user) return null;
    
    // Attach tenant name + CUI for sidebar display
    if (user.tenantId) {
      try {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (db) {
          const { tenants } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const [tenant] = await db
            .select({ name: tenants.name, cui: tenants.cui })
            .from(tenants)
            .where(eq(tenants.id, user.tenantId));
          if (tenant)
            return {
              ...user,
              tenantName: tenant.name,
              tenantCUI: tenant.cui,
            };
        }
      } catch (_) {}
    }
    return user;
  }),

  /**
   * Logout (client-side only, just clear token)
   */
  logout: publicProcedure.mutation(() => {
    return { success: true };
  }),

  /**
   * Forgot Password - generate token and send email
   */
  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const token = await generatePasswordResetToken(input.email);
      if (token) {
        const resetLink = `${APP_URL}/reset-password?token=${token}`;
        console.log(`[AUTH] Password reset requested for ${input.email}. Token: ${token}`);
        
        try {
          await resend.emails.send({
            from: `Smart Invoice <${EMAIL_FROM}>`,
            to: input.email,
            subject: "Resetare Parolă",
            html: `
              <div style="font-family: sans-serif; max-w-md; margin: 0 auto; padding: 20px;">
                <h2 style="color: #003366;">Resetare Parolă</h2>
                <p>Am primit o cerere de resetare a parolei pentru contul tău.</p>
                <p>Click pe butonul de mai jos pentru a seta o parolă nouă. Link-ul expiră într-o oră.</p>
                <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; margin-top: 10px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;">Resetează Parola</a>
                <p style="margin-top: 30px; font-size: 12px; color: #666;">Dacă nu ai solicitat tu asta, ignoră acest e-mail.</p>
              </div>
            `
          });
          console.log(`[AUTH] Reset email sent to ${input.email}`);
        } catch (error) {
          console.error(`[AUTH] Failed to send email via Resend:`, error);
        }
      }
      return { success: true };
    }),

  /**
   * Reset Password with token
   */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: z.string().min(8),
      })
    )
    .mutation(async ({ input }) => {
      await resetPasswordWithToken(input.token, input.newPassword);
      return { success: true };
    }),

  /**
   * Change Password (logged in users)
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user || !ctx.user.accountId) {
        throw new Error("Unauthorized");
      }
      await changePassword(ctx.user.accountId, input.currentPassword, input.newPassword);
      return { success: true };
    }),

  /**
   * Google Login / Register
   */
  googleLogin: publicProcedure
    .input(z.object({ credential: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: input.credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        
        if (!payload || !payload.email) {
          throw new Error("Invalid Google token or email missing");
        }
        
        const email = payload.email;
        let account = await getAccountByEmail(email);
        
        if (!account) {
          // Create new account if it doesn't exist
          const newAccountId = await createGoogleAccount(email);
          account = await getAccountById(newAccountId);
        }
        
        if (!account) {
          throw new Error("Failed to process Google login");
        }
        
        if (!account.isActive) {
          throw new Error("Account is inactive");
        }
        
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
        console.error("Google login error:", error);
        throw new Error("Eroare la autentificarea cu Google");
      }
    }),
});
