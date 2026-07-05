export interface ClientData {
  firstName: string;
  lastName: string;
  ssnLast4: string;
  dob: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface ScorePullResult {
  score_eq: number | null;
  score_exp: number | null;
  score_tu: number | null;
  raw_response?: Record<string, unknown>;
  error?: string;
}

// TODO: Verify endpoint URL and field names with MyFreeScoreNow's partner portal —
// this is the correctly-shaped request/response handling for a Basic-Auth JSON API,
// but the exact path and response field names are placeholders until an agency
// configures real partner credentials and this can be verified against a live call.
export async function pullMyFreeScoreNow(
  apiKey: string,
  apiSecret: string,
  clientData: ClientData
): Promise<ScorePullResult> {
  try {
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

    const response = await fetch("https://api.myfreescorenow.com/v1/scores", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        first_name: clientData.firstName,
        last_name: clientData.lastName,
        ssn: clientData.ssnLast4,
        dob: clientData.dob,
        address: clientData.address,
        city: clientData.city,
        state: clientData.state,
        zip: clientData.zip,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { score_eq: null, score_exp: null, score_tu: null, error: `API error: ${response.status}` };
    }

    const data = (await response.json()) as Record<string, unknown>;

    return {
      score_eq: typeof data.equifax_score === "number" ? data.equifax_score : typeof data.scores === "object" && data.scores !== null && "equifax" in data.scores ? Number(data.scores.equifax) || null : null,
      score_exp: typeof data.experian_score === "number" ? data.experian_score : typeof data.scores === "object" && data.scores !== null && "experian" in data.scores ? Number(data.scores.experian) || null : null,
      score_tu: typeof data.transunion_score === "number" ? data.transunion_score : typeof data.scores === "object" && data.scores !== null && "transunion" in data.scores ? Number(data.scores.transunion) || null : null,
      raw_response: data,
    };
  } catch (err) {
    return { score_eq: null, score_exp: null, score_tu: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Lightweight reachability/credential-shape check for the Settings "Test Connection" button. */
export async function testMyFreeScoreNowConnection(apiKey: string, apiSecret: string): Promise<{ ok: boolean; message: string }> {
  if (!apiKey.trim() || !apiSecret.trim()) {
    return { ok: false, message: "Enter both an API key and API secret." };
  }
  try {
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const response = await fetch("https://api.myfreescorenow.com/v1/scores", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(8000),
    });
    // A 401/403 means the endpoint rejected the credentials specifically; anything
    // else responding at all (including a 4xx for the empty body) confirms the
    // host + auth scheme are reachable, which is as far as a keyless test can go.
    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: "Credentials rejected by MyFreeScoreNow." };
    }
    return { ok: true, message: "Reached MyFreeScoreNow with these credentials." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not reach MyFreeScoreNow." };
  }
}
