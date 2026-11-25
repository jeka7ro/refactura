/**
 * Handle Google OAuth callback
 * Verify Google token and create/update user account
 */
export async function handleGoogleAuth(
  _googleToken: string,
  _email: string,
  _name: string
): Promise<{
  success: boolean;
  token: string;
  account: { id: number; email: string; role: "superadmin" | "admin" | "user"; tenantId: number | null };
}> {
  throw new Error("OAuth provider verification not implemented");
}

/**
 * Handle Apple OAuth callback
 * Verify Apple token and create/update user account
 */
export async function handleAppleAuth(
  _appleToken: string,
  _email: string,
  _name: string
): Promise<{
  success: boolean;
  token: string;
  account: { id: number; email: string; role: "superadmin" | "admin" | "user"; tenantId: number | null };
}> {
  throw new Error("OAuth provider verification not implemented");
}

/**
 * Handle Meta/Facebook OAuth callback
 * Verify Meta token and create/update user account
 */
export async function handleMetaAuth(
  _metaToken: string,
  _email: string,
  _name: string
): Promise<{
  success: boolean;
  token: string;
  account: { id: number; email: string; role: "superadmin" | "admin" | "user"; tenantId: number | null };
}> {
  throw new Error("OAuth provider verification not implemented");
}
