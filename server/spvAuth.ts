import type { Express } from "express";
import crypto from "crypto";
import { getDb } from "./db";
import { integrations, userTenants } from "../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { ENV } from "./_core/env";
import { authenticateFileRequest } from "./fileAuth";
import { isValidBidirectionalPair } from "./tenant";
import { getEffectiveJwtSecret } from "./session";

function getSpvStateSecret(): string {
  return getEffectiveJwtSecret();
}

export function createSpvOAuthState(tenantId: number): string {
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const payload = `${tenantId}:${expiresAt}`;
  const sig = crypto
    .createHmac("sha256", getSpvStateSecret())
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

export function verifySpvOAuthState(stateStr: string): number | null {
  try {
    if (!stateStr) return null;
    const dotIdx = stateStr.indexOf(".");
    if (dotIdx <= 0) return null;
    const payload = stateStr.slice(0, dotIdx);
    const sig = stateStr.slice(dotIdx + 1);
    const [tIdStr, expStr] = payload.split(":");
    const tenantId = parseInt(tIdStr, 10);
    const expiresAt = parseInt(expStr, 10);
    if (!Number.isFinite(tenantId) || tenantId <= 0 || !Number.isFinite(expiresAt)) {
      return null;
    }
    if (Date.now() > expiresAt) return null;

    const expected = crypto
      .createHmac("sha256", getSpvStateSecret())
      .update(payload)
      .digest("hex");
    if (
      sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))
    ) {
      return null;
    }
    return tenantId;
  } catch {
    return null;
  }
}

function extractJwtSub(jwtToken?: string | null): string | null {
  if (!jwtToken) return null;
  const parts = String(jwtToken).split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );
    return payload?.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

export function registerSpvAuth(app: Express) {
  // Initiates the OAuth flow
  app.get("/api/spv/auth", async (req, res) => {
    const auth = await authenticateFileRequest(req);
    if (!auth) {
      return res.status(401).send("Neautentificat.");
    }

    const askedId = req.query.tenantId ? parseInt(String(req.query.tenantId), 10) : auth.tenantId;
    if (!Number.isFinite(askedId) || askedId <= 0) {
      return res.status(400).send("Tenant ID is required.");
    }

    if (askedId !== auth.tenantId && auth.role !== "superadmin") {
      const db = await getDb();
      if (!db) {
        return res.status(500).send("Database connection failed.");
      }
      const [ut] = auth.accountId
        ? await db
            .select({ id: userTenants.id })
            .from(userTenants)
            .where(
              and(
                eq(userTenants.userId, auth.accountId),
                eq(userTenants.tenantId, askedId),
                eq(userTenants.isActive, 1)
              )
            )
            .limit(1)
        : [undefined];
      const pairedOk = ut ? true : await isValidBidirectionalPair(db, auth.tenantId, askedId);
      if (!ut && !pairedOk) {
        return res.status(403).send("Acces interzis la acest profil.");
      }
    }

    const clientId = process.env.SPV_CLIENT_ID;
    const redirectUri =
      process.env.SPV_CALLBACK_URL ||
      `${req.protocol}://${req.get("host")}/api/spv/callback`;

    if (!clientId) {
      return res
        .status(500)
        .send("SPV_CLIENT_ID is not configured on the server.");
    }

    const authUrl = new URL(
      "https://logincert.anaf.ro/anaf-oauth2/v1/authorize"
    );
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("token_content_type", "jwt");
    authUrl.searchParams.append("state", createSpvOAuthState(askedId));

    res.redirect(authUrl.toString());
  });

  // Callback from ANAF
  app.get("/api/spv/callback", async (req, res) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.redirect(
        `/integrari?spv_error=${encodeURIComponent(String(error))}&spv_error_desc=${encodeURIComponent(String(error_description || ""))}`
      );
    }

    if (!code || !state) {
      return res.status(400).send("Missing code or state from ANAF.");
    }

    const tenantId = verifySpvOAuthState(String(state));
    if (!tenantId) {
      return res.status(400).send("Invalid or expired OAuth state.");
    }

    const clientId = process.env.SPV_CLIENT_ID;
    const clientSecret = process.env.SPV_CLIENT_SECRET;
    const redirectUri =
      process.env.SPV_CALLBACK_URL ||
      `${req.protocol}://${req.get("host")}/api/spv/callback`;

    if (!clientId || !clientSecret) {
      return res
        .status(500)
        .send("SPV credentials not configured on the server.");
    }

    try {
      const tokenRes = await fetch(
        "https://logincert.anaf.ro/anaf-oauth2/v1/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: code as string,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            token_content_type: "jwt",
          }).toString(),
        }
      );

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        return res
          .status(502)
          .send(
            `Failed to fetch token from ANAF: ${tokenRes.status} ${errText}`
          );
      }

      const tokenData = await tokenRes.json();

      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const expiresIn = tokenData.expires_in; // usually seconds

      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

      const db = await getDb();
      if (!db) {
        return res.status(500).send("Database connection failed.");
      }

      const [existing] = await db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.tenantId, tenantId),
            eq(integrations.provider, "spv")
          )
        );

      if (existing) {
        await db
          .update(integrations)
          .set({
            apiKey: accessToken,
            apiSecret: refreshToken,
            tokenExpiresAt: expiresAt,
            status: "active",
          })
          .where(eq(integrations.id, existing.id));
      } else {
        await db.insert(integrations).values({
          tenantId,
          provider: "spv",
          apiKey: accessToken,
          apiSecret: refreshToken,
          tokenExpiresAt: expiresAt,
          status: "active",
        });
      }

      // Sync other SPV integration rows sharing the exact same USB certificate subject (`sub`)
      const newSub = extractJwtSub(accessToken);
      if (newSub) {
        const spvRows = await db
          .select({
            id: integrations.id,
            tenantId: integrations.tenantId,
            apiKey: integrations.apiKey,
          })
          .from(integrations)
          .where(eq(integrations.provider, "spv"));
        const matchingIds = spvRows
          .filter(
            (row) => row.tenantId !== tenantId && extractJwtSub(row.apiKey) === newSub
          )
          .map((row) => row.id);
        if (matchingIds.length > 0) {
          await db
            .update(integrations)
            .set({
              apiKey: accessToken,
              apiSecret: refreshToken,
              tokenExpiresAt: expiresAt,
              status: "active",
            })
            .where(inArray(integrations.id, matchingIds));
        }
      }

      // Redirect back to integrations page with success
      res.redirect("/integrari?spv_success=true");
    } catch (err: any) {
      res
        .status(500)
        .send(`Internal Server Error during SPV auth: ${err.message}`);
    }
  });
}
