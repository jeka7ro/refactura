import { createAccount, getAccountByEmail } from "./auth";
import { createSessionToken } from "./session";

/**
 * Handle Google OAuth callback
 * Verify Google token and create/update user account
 */
export async function handleGoogleAuth(googleToken: string, email: string, name: string) {
  try {
    // TODO: Verify Google token with Google API
    // const verifyUrl = 'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + googleToken;
    // const response = await fetch(verifyUrl);
    // const tokenInfo = await response.json();

    // Check if account exists
    let account = await getAccountByEmail(email);

    // If not, create new account
    if (!account) {
      await createAccount(email, "", undefined, "user");
      account = await getAccountByEmail(email);
    }

    if (!account) {
      throw new Error("Failed to create account");
    }

    // Create session token
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
    throw new Error(`Google authentication failed: ${(error as Error).message}`);
  }
}

/**
 * Handle Apple OAuth callback
 * Verify Apple token and create/update user account
 */
export async function handleAppleAuth(appleToken: string, email: string, name: string) {
  try {
    // TODO: Verify Apple token with Apple API
    // const verifyUrl = 'https://appleid.apple.com/auth/oauth2/v2/token';
    // Implement Apple token verification

    // Check if account exists
    let account = await getAccountByEmail(email);

    // If not, create new account
    if (!account) {
      await createAccount(email, "", undefined, "user");
      account = await getAccountByEmail(email);
    }

    if (!account) {
      throw new Error("Failed to create account");
    }

    // Create session token
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
    throw new Error(`Apple authentication failed: ${(error as Error).message}`);
  }
}

/**
 * Handle Meta/Facebook OAuth callback
 * Verify Meta token and create/update user account
 */
export async function handleMetaAuth(metaToken: string, email: string, name: string) {
  try {
    // TODO: Verify Meta token with Meta API
    // const verifyUrl = `https://graph.instagram.com/me?access_token=${metaToken}`;
    // const response = await fetch(verifyUrl);
    // const userData = await response.json();

    // Check if account exists
    let account = await getAccountByEmail(email);

    // If not, create new account
    if (!account) {
      await createAccount(email, "", undefined, "user");
      account = await getAccountByEmail(email);
    }

    if (!account) {
      throw new Error("Failed to create account");
    }

    // Create session token
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
    throw new Error(`Meta authentication failed: ${(error as Error).message}`);
  }
}
