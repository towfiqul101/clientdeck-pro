import "server-only";
import { getGHLCustomFields } from "@/lib/ghl/api";
import { RTP_IDENTITY_FIELDS } from "@/lib/ghl/setup-config";
import type { Agency } from "@/types";

export interface GhlFieldStatus {
  /** GHL fieldKey (bare, no `contact.` prefix) → human-readable field name. */
  namesByKey: Record<string, string>;
  /** RTP-owned identity fields that already exist in the agency's location. */
  identityPresent: string[];
  /** RTP-owned identity fields still missing (run the setup tool to create). */
  identityMissing: string[];
  /** False when GHL isn't connected, or the field list couldn't be read. */
  available: boolean;
}

const bare = (k: string) => k.replace(/^contact\./, "");

/**
 * Reads the agency's GHL custom fields so Settings → GHL can (a) show the
 * human-readable NAME next to each mapped key — without it, a user reviewing
 * `contact.contactequifax_password` has no way to see it says "Equifax
 * Password" — and (b) tell whether the RTP-owned identity fields exist yet.
 *
 * Best-effort: never throws, returns available:false when GHL is unreachable.
 */
export async function getGhlFieldStatus(agency: Agency): Promise<GhlFieldStatus> {
  const empty: GhlFieldStatus = {
    namesByKey: {},
    identityPresent: [],
    identityMissing: RTP_IDENTITY_FIELDS.map((f) => f.fieldKey),
    available: false,
  };

  if (!agency.ghl_api_key || !agency.ghl_location_id) return empty;

  try {
    const fields = await getGHLCustomFields({
      apiKey: agency.ghl_api_key,
      locationId: agency.ghl_location_id,
    });

    const namesByKey: Record<string, string> = {};
    const present = new Set<string>();
    for (const f of fields) {
      const key = bare(f.fieldKey ?? "");
      if (key) namesByKey[key] = f.name;
      if (f.id) namesByKey[f.id] = f.name;
      if (key) present.add(key);
    }

    const identityPresent = RTP_IDENTITY_FIELDS.filter((f) => present.has(f.fieldKey)).map(
      (f) => f.fieldKey
    );
    const identityMissing = RTP_IDENTITY_FIELDS.filter((f) => !present.has(f.fieldKey)).map(
      (f) => f.fieldKey
    );

    return { namesByKey, identityPresent, identityMissing, available: true };
  } catch {
    return empty;
  }
}
