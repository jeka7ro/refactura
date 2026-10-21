import { TRPCError } from "@trpc/server";

/**
 * Returnează firma (tenant) utilizatorului curent.
 * Nu mai există fallback tăcut la firma 1 — fără firmă setată, accesul este refuzat,
 * ca să nu se vadă niciodată datele altei firme.
 */
export function tenantOf(ctx: {
  user?: { tenantId?: number | null } | null;
}): number {
  const t = ctx.user?.tenantId;
  if (!t) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Contul nu are nicio firmă selectată. Selectează sau creează o firmă.",
    });
  }
  return t;
}
