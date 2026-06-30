import type { Express } from "express";
import { getDb } from "./db";
import { integrations } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { ENV } from "./_core/env";

export function registerSpvAuth(app: Express) {
  // Initiates the OAuth flow
  app.get("/api/spv/auth", (req, res) => {
    const { tenantId } = req.query;
    if (!tenantId) {
      return res.status(400).send("Tenant ID is required.");
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
    // You can pass the tenantId in state so it returns in the callback
    authUrl.searchParams.append("state", String(tenantId));

    res.redirect(authUrl.toString());
  });

  // Callback from ANAF
  app.get("/api/spv/callback", async (req, res) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res
        .status(400)
        .send(`ANAF Auth Error: ${error} - ${error_description}`);
    }

    if (!code || !state) {
      return res.status(400).send("Missing code or state from ANAF.");
    }

    const tenantId = parseInt(state as string, 10);
    if (isNaN(tenantId)) {
      return res.status(400).send("Invalid state (tenantId).");
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

      // Redirect back to integrations page with success
      res.redirect("/integrations?spv_success=true");
    } catch (err: any) {
      res
        .status(500)
        .send(`Internal Server Error during SPV auth: ${err.message}`);
    }
  });
}
