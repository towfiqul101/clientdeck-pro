import { cache } from "react";
import { cookies } from "next/headers";
import { validatePortalToken } from "@/lib/utils/portal-token";
import type { Agency, Client } from "@/types";

export const PORTAL_COOKIE = "portal_session";

/**
 * Resolves the current portal visitor from the `portal_session` cookie.
 * Cached per request so the portal layout and page share one validation.
 * Returns null when there is no cookie or the token is invalid/expired.
 */
export const getPortalSession = cache(
  async (): Promise<{ client: Client; agency: Agency } | null> => {
    const store = await cookies();
    const token = store.get(PORTAL_COOKIE)?.value;
    if (!token) return null;
    return validatePortalToken(token);
  }
);
