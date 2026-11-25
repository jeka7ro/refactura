import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "../shared/const";
import { z } from "zod";
import { authenticateAccount, createAccount, getAccountByEmail, generatePasswordResetToken, resetPasswordWithToken, changePassword, createGoogleAccount, getAccountById } from "./auth";
import { createSessionToken } from "./session";
import { Resend } from "resend";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client();

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key_to_prevent_crash_on_boot");
const EMAIL_FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

type RateLimitEntry = { count: number; resetAt: number };
const loginRateLimit = new Map<string, RateLimitEntry>();
const forgotPasswordRateLimit = new Map<string, RateLimitEntry>();
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILED_ATTEMPTS = 12;
const FORGOT_PASSWORD_MAX_REQUESTS = 5;

function pruneExpiredRateEntries(store: Map<string, RateLimitEntry>, now: number) {
  for (const [key, entry] of Array.from(store.entries())) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}

function getRequestClientIp(req: any): string {
  return req?.ip || req?.socket?.remoteAddress || "unknown";
}

async function resolveSuperadminLoginTenantId(account: {
  id: number;
  email: string;
  role: string;
  tenantId: number | null;
}): Promise<number | null> {
  let activeTenantId = account.tenantId;
  if (account.role !== "superadmin") return activeTenantId;
  if (account.email !== "jeka7ro@gmail.com" && account.email !== "contact@getapp.ro") {
    return activeTenantId;
  }
  if (activeTenantId && activeTenantId !== 1) {
    try {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (db) {
        const { tenants, userTenants } = await import("../drizzle/schema");
        const { and, eq } = await import("drizzle-orm");
        const [t] = await db
          .select({ id: tenants.id, cui: tenants.cui, settings: tenants.settings })
          .from(tenants)
          .where(eq(tenants.id, activeTenantId))
          .limit(1);
        if (t) {
          let s: any = {};
          try {
            const parsed = JSON.parse(t.settings || "{}");
            s = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
          } catch {}
          const cleanCode = String(t.cui || "").replace(/^RO/i, "").trim();
          const isPf = s?.entityType === "pf" || /^\d{13}$/.test(cleanCode);
          if (isPf) {
            const [owned] = await db
              .select({ id: userTenants.id })
              .from(userTenants)
              .where(
                and(
                  eq(userTenants.userId, account.id),
                  eq(userTenants.tenantId, t.id),
                  eq(userTenants.isActive, 1)
                )
              )
              .limit(1);
            if (owned || Number(s?.pairedPjTenantId) === 1) {
              return activeTenantId;
            }
          }
        }
      }
    } catch {}
  }

  activeTenantId = 1;
  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (db) {
      const { accounts } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(accounts).set({ tenantId: 1 }).where(eq(accounts.id, account.id));
    }
  } catch (e) {
    console.warn("[Auth] Failed to reset superadmin tenantId to 1:", e);
  }
  return activeTenantId;
}

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
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const now = Date.now();
      pruneExpiredRateEntries(loginRateLimit, now);
      const rateKey = `${getRequestClientIp(ctx.req)}:${input.email.trim().toLowerCase()}`;
      const existing = loginRateLimit.get(rateKey);
      if (existing && now < existing.resetAt && existing.count >= LOGIN_MAX_FAILED_ATTEMPTS) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Prea multe încercări eșuate. Te rugăm să încerci din nou peste 15 minute.",
        });
      }

      try {
        const account = await authenticateAccount(input.email, input.password);
        loginRateLimit.delete(rateKey);

        const activeTenantId = await resolveSuperadminLoginTenantId(account);

        const token = await createSessionToken({
          accountId: account.id,
          email: account.email,
          role: account.role,
          tenantId: activeTenantId || undefined,
        });

        return {
          success: true,
          token,
          account: {
            id: account.id,
            email: account.email,
            role: account.role,
            tenantId: activeTenantId,
          },
        };
      } catch (error) {
        const prev = loginRateLimit.get(rateKey);
        const count = prev && now < prev.resetAt ? prev.count + 1 : 1;
        const resetAt = prev && now < prev.resetAt ? prev.resetAt : now + AUTH_RATE_WINDOW_MS;
        loginRateLimit.set(rateKey, { count, resetAt });
        throw new Error("Invalid email or password");
      }
    }),

  /**
   * Get current account info
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user;
    if (!user) return null;
    
    // Attach tenant name + CUI + logo for sidebar and navbar display
    if (user.tenantId) {
      try {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (db) {
          const { tenants } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const [tenant] = await db
            .select({ name: tenants.name, cui: tenants.cui, settings: tenants.settings })
            .from(tenants)
            .where(eq(tenants.id, user.tenantId));
          if (tenant) {
            let tenantLogo: string | null = null;
            let logoHasBackground = false;
            let logoBgColor: string | null = null;
            let parsedS: any = {};
            if (tenant.settings) {
              try {
                const rawParsed =
                  typeof tenant.settings === "string" ? JSON.parse(tenant.settings) : tenant.settings;
                parsedS =
                  rawParsed && typeof rawParsed === "object" && !Array.isArray(rawParsed)
                    ? rawParsed
                    : {};
                tenantLogo = parsedS.logoBase64 || null;
                logoHasBackground = Boolean(parsedS.logoHasBackground);
                logoBgColor = parsedS.logoBgColor || null;
              } catch (_) {}
            }
            const cleanCode = String(tenant.cui || "").replace(/^RO/i, "").trim();
            const tenantEntityType: "pj" | "pf" =
              parsedS?.entityType === "pf" || /^\d{13}$/.test(cleanCode) ? "pf" : "pj";
            return {
              ...user,
              tenantName: tenant.name,
              tenantCUI: tenant.cui,
              tenantEntityType,
              tenantLogo,
              logoHasBackground,
              logoBgColor,
            };
          }
        }
      } catch (_) {}
    }
    return user;
  }),

  /**
   * Logout — clear session cookie on server & client
   */
  logout: publicProcedure.mutation(({ ctx }) => {
    const isSecure =
      ctx.req?.protocol === "https" ||
      String(ctx.req?.headers?.["x-forwarded-proto"] || "").includes("https");
    ctx.res?.clearCookie?.(COOKIE_NAME, {
      maxAge: -1,
      secure: isSecure,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
    if (typeof (ctx.res as any)?.cookie === "function" || ctx.req?.headers?.cookie) {
      ctx.res?.clearCookie?.("authToken", {
        maxAge: -1,
        path: "/",
        sameSite: "lax",
        secure: isSecure,
      });
      ctx.res?.clearCookie?.("accountantSession", {
        maxAge: -1,
        path: "/",
        secure: isSecure,
      });
    }
    return { success: true };
  }),

  /**
   * Forgot Password - generate token and send email
   */
  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const now = Date.now();
      pruneExpiredRateEntries(forgotPasswordRateLimit, now);
      const rateKey = `${getRequestClientIp(ctx.req)}:${input.email.trim().toLowerCase()}`;
      const existing = forgotPasswordRateLimit.get(rateKey);
      if (existing && now < existing.resetAt && existing.count >= FORGOT_PASSWORD_MAX_REQUESTS) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Prea multe cereri de resetare a parolei. Te rugăm să încerci din nou peste 15 minute.",
        });
      }
      const count = existing && now < existing.resetAt ? existing.count + 1 : 1;
      const resetAt = existing && now < existing.resetAt ? existing.resetAt : now + AUTH_RATE_WINDOW_MS;
      forgotPasswordRateLimit.set(rateKey, { count, resetAt });

      const token = await generatePasswordResetToken(input.email);
      if (token) {
        const resetLink = `${APP_URL}/reset-password?token=${token}`;
        console.log(`[AUTH] Password reset requested for ${input.email}.`);
        
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
    .input(z.object({ credential: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const expectedAudience = (
        process.env.GOOGLE_CLIENT_ID ||
        process.env.VITE_GOOGLE_CLIENT_ID ||
        ""
      ).trim();
      if (!expectedAudience) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Autentificarea cu Google nu este configurată pe server.",
        });
      }

      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: input.credential,
          audience: expectedAudience,
        });
        const payload = ticket.getPayload();
        
        if (
          !payload ||
          payload.aud !== expectedAudience ||
          !payload.email ||
          !payload.email_verified
        ) {
          throw new Error("Invalid Google token or unverified email");
        }
        
        const email = payload.email;
        let account = await getAccountByEmail(email);
        
        if (!account) {
          // Create new account if it doesn't exist
          const newAccountId = Number(await createGoogleAccount(email));
          account = await getAccountById(newAccountId);
        }
        
        if (!account) {
          throw new Error("Failed to process Google login");
        }
        
        if (!account.isActive) {
          throw new Error("Account is inactive");
        }
        
        const activeTenantId = await resolveSuperadminLoginTenantId(account);

        const token = await createSessionToken({
          accountId: account.id,
          email: account.email,
          role: account.role,
          tenantId: activeTenantId || undefined,
        });

        return {
          success: true,
          token,
          account: {
            id: account.id,
            email: account.email,
            role: account.role,
            tenantId: activeTenantId,
          },
        };
      } catch (error) {
        console.error("Google login error:", error);
        if (error instanceof TRPCError) throw error;
        throw new Error((error as Error)?.message || "Eroare la autentificarea cu Google");
      }
    }),
});
