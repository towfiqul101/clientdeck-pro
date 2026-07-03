// ============================================
// ClientDeck Pro — GHL API v2 Wrapper
// Handles all outbound sync: app → GHL
// ============================================

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

/**
 * Creates a contact in GHL. Returns the new contact id, or null on failure
 * (callers should treat GHL sync as best-effort and not block the app write).
 */
export async function createGHLContact(
  input: CreateGHLContactInput,
  opts: GHLRequestOptions
): Promise<string | null> {
  try {
    const data = await ghlFetch(`/contacts/`, opts, {
      method: "POST",
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
    return data?.contact?.id ?? null;
  } catch (error) {
    console.error("Failed to create GHL contact:", error);
    return null;
  }
}

export async function updateGHLContactFields(
  contactId: string,
  customFields: Record<string, string | number>,
  opts: GHLRequestOptions
) {
  // GHL custom fields are updated via the contact update endpoint
  // Custom field keys should match the field names created in GHL
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
      dispute_round_current: roundNumber,
      next_dispute_date: new Date(
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
      items_deleted_total: totalDeletions,
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
  if (scores.eq) fields.credit_score_eq_current = scores.eq;
  if (scores.exp) fields.credit_score_exp_current = scores.exp;
  if (scores.tu) fields.credit_score_tu_current = scores.tu;

  await updateGHLContactFields(contactId, fields, opts);
}

export async function syncClientCompleted(
  contactId: string,
  opts: GHLRequestOptions
) {
  await Promise.allSettled([
    addGHLTag(contactId, ["goal-achieved"], opts),
    removeGHLTag(contactId, ["active-client"], opts),
    addGHLNote(
      contactId,
      `[ClientDeck Pro] Client has achieved their credit goal! Case completed.`,
      opts
    ),
  ]);
}
