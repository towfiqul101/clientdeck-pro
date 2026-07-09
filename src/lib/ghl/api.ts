// ============================================
// ClientDeck Pro — GHL API v2 Wrapper
// Handles all outbound sync: app → GHL
// ============================================

import { GHL_FIELD_KEYS } from "./field-keys";

const GHL_BASE_URL = "https://services.leadconnectorhq.com";

interface GHLRequestOptions {
  apiKey: string;
  locationId: string;
}

async function ghlFetch(
  path: string,
  options: GHLRequestOptions,
  init?: RequestInit
) {
  const url = `${GHL_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`GHL API Error [${response.status}]: ${error}`);
    throw new Error(`GHL API error: ${response.status}`);
  }

  return response.json();
}

// ============================================
// CONNECTION TEST
// ============================================

/**
 * Verifies GHL credentials by fetching the location. Returns a discriminated
 * result rather than throwing so callers (e.g. the settings "Test Connection"
 * button) can surface a friendly message.
 */
export async function verifyGHLConnection(opts: GHLRequestOptions): Promise<
  | { ok: true; locationName: string | null }
  | { ok: false; error: string }
> {
  try {
    const response = await fetch(
      `${GHL_BASE_URL}/locations/${opts.locationId}`,
      {
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          Version: "2021-07-28",
        },
      }
    );

    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: "Invalid API key — authentication failed." };
    }
    if (response.status === 404) {
      return { ok: false, error: "Location not found — check the Location ID." };
    }
    if (!response.ok) {
      return { ok: false, error: `GHL returned status ${response.status}.` };
    }

    const data = await response.json();
    return { ok: true, locationName: data?.location?.name ?? null };
  } catch {
    return { ok: false, error: "Could not reach GoHighLevel. Try again." };
  }
}

// ============================================
// CONTACTS
// ============================================

export async function getGHLContact(
  contactId: string,
  opts: GHLRequestOptions
) {
  return ghlFetch(`/contacts/${contactId}`, opts);
}

interface CreateGHLContactInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  address1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}

export type CreateGHLContactResult =
  | { ok: true; id: string; duplicate: boolean }
  | { ok: false; error: string };

/**
 * Creates a contact in GHL, returning a typed result so callers can surface the
 * real failure instead of a silent no-op. Handles GHL's duplicate-contact case
 * (HTTP 400 with the existing id in `meta.contactId`) by reusing that contact,
 * and maps auth failures to an actionable message.
 */
export async function createGHLContact(
  input: CreateGHLContactInput,
  opts: GHLRequestOptions
): Promise<CreateGHLContactResult> {
  let response: Response;
  try {
    response = await fetch(`${GHL_BASE_URL}/contacts/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
      body: JSON.stringify({
        locationId: opts.locationId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email || undefined,
        phone: input.phone || undefined,
        address1: input.address1 || undefined,
        city: input.city || undefined,
        state: input.state || undefined,
        postalCode: input.postalCode || undefined,
      }),
    });
  } catch {
    return { ok: false, error: "Could not reach GoHighLevel. Check your connection and try again." };
  }

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON response */
  }
  const b = (body ?? {}) as {
    contact?: { id?: string };
    meta?: { contactId?: string };
    message?: string | string[];
  };

  if (response.ok) {
    const id = b.contact?.id;
    if (id) return { ok: true, id, duplicate: false };
    return { ok: false, error: "GoHighLevel accepted the request but returned no contact id." };
  }

  // Duplicate contact — GHL returns 400 with the existing id in meta.contactId.
  const dupId = b.meta?.contactId;
  if (dupId) return { ok: true, id: dupId, duplicate: true };

  if (response.status === 401 || response.status === 403) {
    console.error(`createGHLContact auth failure [${response.status}]:`, text);
    return {
      ok: false,
      error: "GoHighLevel rejected the API key. Re-check the API key (PIT) and Location ID in Settings → GHL.",
    };
  }

  const msg = Array.isArray(b.message) ? b.message.join(", ") : b.message;
  console.error(`createGHLContact failed [${response.status}]:`, text);
  return { ok: false, error: msg || `GoHighLevel returned status ${response.status}.` };
}

export async function updateGHLContactFields(
  contactId: string,
  fields: Record<string, string | number>,
  opts: GHLRequestOptions
) {
  // GHL v2 expects customFields as an ARRAY of { key, field_value } — NOT an
  // object of key→value. Sending an object is silently ignored (fields stay
  // empty). `key` is the GHL field key (see field-keys.ts); values are
  // stringified because GHL stores field values as strings.
  const customFields = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => ({ key, field_value: String(value) }));

  if (customFields.length === 0) return null;

  return ghlFetch(`/contacts/${contactId}`, opts, {
    method: "PUT",
    body: JSON.stringify({ customFields }),
  });
}

export async function addGHLTag(
  contactId: string,
  tags: string[],
  opts: GHLRequestOptions
) {
  return ghlFetch(`/contacts/${contactId}/tags`, opts, {
    method: "POST",
    body: JSON.stringify({ tags }),
  });
}

export async function removeGHLTag(
  contactId: string,
  tags: string[],
  opts: GHLRequestOptions
) {
  return ghlFetch(`/contacts/${contactId}/tags`, opts, {
    method: "DELETE",
    body: JSON.stringify({ tags }),
  });
}

// ============================================
// PIPELINES / OPPORTUNITIES
// ============================================

export async function moveGHLPipelineStage(
  opportunityId: string,
  stageId: string,
  opts: GHLRequestOptions
) {
  return ghlFetch(
    `/opportunities/${opportunityId}`,
    opts,
    {
      method: "PUT",
      body: JSON.stringify({ stageId }),
    }
  );
}

/**
 * Finds an existing GHL opportunity for this contact in the given pipeline,
 * or creates one in the pipeline's first stage if none exists. Best-effort —
 * returns null on any failure rather than throwing (mirrors the existing
 * `createGHLPipeline` best-effort pattern in this file).
 */
export async function findOrCreateGHLOpportunity(
  contactId: string,
  pipelineId: string,
  opts: GHLRequestOptions
): Promise<string | null> {
  try {
    const searchData = await ghlFetch(
      `/opportunities/search?locationId=${opts.locationId}&contactId=${contactId}&pipelineId=${pipelineId}`,
      opts
    );
    const existing = searchData?.opportunities?.[0];
    if (existing?.id) return existing.id as string;

    const created = await ghlFetch(`/opportunities/`, opts, {
      method: "POST",
      body: JSON.stringify({
        pipelineId,
        locationId: opts.locationId,
        contactId,
        name: "ClientDeck Pro Client",
        status: "open",
      }),
    });
    return created?.opportunity?.id ?? null;
  } catch (err) {
    console.error("findOrCreateGHLOpportunity failed:", err);
    return null;
  }
}

// ============================================
// TASKS
// ============================================

export async function createGHLTask(
  contactId: string,
  title: string,
  dueDate: string,
  opts: GHLRequestOptions
) {
  return ghlFetch(`/contacts/${contactId}/tasks`, opts, {
    method: "POST",
    body: JSON.stringify({
      title,
      dueDate,
      completed: false,
    }),
  });
}

// ============================================
// NOTES
// ============================================

export async function addGHLNote(
  contactId: string,
  body: string,
  opts: GHLRequestOptions
) {
  return ghlFetch(`/contacts/${contactId}/notes`, opts, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

// ============================================
// HIGH-LEVEL SYNC ACTIONS
// Used by the app when events happen
// ============================================

export async function syncRoundSent(
  contactId: string,
  roundNumber: number,
  itemsDisputed: number,
  opts: GHLRequestOptions
) {
  await Promise.allSettled([
    updateGHLContactFields(contactId, {
      [GHL_FIELD_KEYS.ROUND_NUMBER]: roundNumber,
      [GHL_FIELD_KEYS.ITEMS_DISPUTED]: itemsDisputed,
      [GHL_FIELD_KEYS.NEXT_DISPUTE_DATE]: new Date(
        Date.now() + 35 * 24 * 60 * 60 * 1000
      ).toISOString().split("T")[0],
    }, opts),
    addGHLTag(contactId, ["round-sent"], opts),
    addGHLNote(
      contactId,
      `[ClientDeck Pro] Round ${roundNumber} sent — ${itemsDisputed} items disputed across all 3 bureaus.`,
      opts
    ),
  ]);
}

export async function syncDeletionAchieved(
  contactId: string,
  deletionsThisRound: number,
  totalDeletions: number,
  opts: GHLRequestOptions
) {
  await Promise.allSettled([
    updateGHLContactFields(contactId, {
      [GHL_FIELD_KEYS.ITEMS_DELETED]: totalDeletions,
      [GHL_FIELD_KEYS.DELETIONS_THIS_ROUND]: deletionsThisRound,
    }, opts),
    addGHLTag(contactId, ["had-deletion"], opts),
    addGHLNote(
      contactId,
      `[ClientDeck Pro] ${deletionsThisRound} item(s) deleted this round! Total deletions: ${totalDeletions}`,
      opts
    ),
  ]);
}

export async function syncScoreUpdate(
  contactId: string,
  scores: {
    eq?: number;
    exp?: number;
    tu?: number;
  },
  opts: GHLRequestOptions
) {
  const fields: Record<string, number> = {};
  if (scores.eq) fields[GHL_FIELD_KEYS.EQ_SCORE] = scores.eq;
  if (scores.exp) fields[GHL_FIELD_KEYS.EXP_SCORE] = scores.exp;
  if (scores.tu) fields[GHL_FIELD_KEYS.TU_SCORE] = scores.tu;

  await updateGHLContactFields(contactId, fields, opts);
}

export async function syncClientCompleted(
  contactId: string,
  opts: GHLRequestOptions
) {
  await Promise.allSettled([
    addGHLTag(contactId, ["goal-achieved", "review-requested", "upsell-candidate"], opts),
    removeGHLTag(contactId, ["active-client"], opts),
    addGHLNote(
      contactId,
      `[ClientDeck Pro] Client has achieved their credit goal! Case completed.`,
      opts
    ),
    createGHLTask(
      contactId,
      "Follow up about Google review — 3 days",
      new Date(Date.now() + 3 * 86400000).toISOString(),
      opts
    ),
  ]);
}

// ============================================
// LOCATION SETUP TOOLS (admin-triggered)
// Custom fields + pipelines. Used by /api/admin/tools/*.
// ============================================

export type GHLFieldDataType = "TEXT" | "NUMERICAL" | "DATE";

export interface GHLCustomFieldSpec {
  name: string;
  fieldKey: string;
  dataType: GHLFieldDataType;
}

interface GHLExistingField {
  id: string;
  name: string;
  fieldKey?: string;
}

/** Lists existing contact custom fields so setup can skip ones already present. */
export async function getGHLCustomFields(
  opts: GHLRequestOptions
): Promise<GHLExistingField[]> {
  const data = await ghlFetch(
    `/locations/${opts.locationId}/customFields?model=contact`,
    opts
  );
  return (data?.customFields ?? []) as GHLExistingField[];
}

/**
 * Creates a single contact custom field. GHL assigns the actual `fieldKey`
 * (prefixed `contact.`), so we match/dedupe on the field NAME.
 */
export async function createGHLCustomField(
  spec: GHLCustomFieldSpec,
  opts: GHLRequestOptions
): Promise<{ created: boolean; error?: string }> {
  try {
    await ghlFetch(`/locations/${opts.locationId}/customFields`, opts, {
      method: "POST",
      body: JSON.stringify({
        name: spec.name,
        dataType: spec.dataType,
        model: "contact",
      }),
    });
    return { created: true };
  } catch (e) {
    return { created: false, error: e instanceof Error ? e.message : "failed" };
  }
}

export interface GHLPipelineSpec {
  name: string;
  stages: string[];
}

export interface GHLPipelineListItem {
  id: string;
  name: string;
  stages?: { id: string; name: string }[];
}

/** Lists existing pipelines (with their stages) so setup can skip/match by name. */
export async function getGHLPipelines(
  opts: GHLRequestOptions
): Promise<GHLPipelineListItem[]> {
  try {
    const data = await ghlFetch(
      `/opportunities/pipelines?locationId=${opts.locationId}`,
      opts
    );
    return (data?.pipelines ?? []) as GHLPipelineListItem[];
  } catch {
    return [];
  }
}

/**
 * Best-effort pipeline creation. GHL's public v2 API does not reliably expose
 * pipeline creation on every plan, so this is wrapped to fail softly — callers
 * surface the message and fall back to the GHL snapshot when unavailable.
 */
export async function createGHLPipeline(
  spec: GHLPipelineSpec,
  opts: GHLRequestOptions
): Promise<{ created: boolean; error?: string }> {
  try {
    await ghlFetch(`/opportunities/pipelines`, opts, {
      method: "POST",
      body: JSON.stringify({
        locationId: opts.locationId,
        name: spec.name,
        stages: spec.stages.map((name, i) => ({ name, position: i })),
      }),
    });
    return { created: true };
  } catch (e) {
    return { created: false, error: e instanceof Error ? e.message : "failed" };
  }
}
