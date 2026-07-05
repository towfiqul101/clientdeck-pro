import type { ClientData, ScorePullResult } from "./myfreescorenow";

// TODO: Verify endpoint URL with IdentityIQ/TransUnion reseller partner portal.
export async function pullIdentityIQ(
  apiKey: string,
  apiSecret: string,
  clientData: ClientData
): Promise<ScorePullResult> {
  try {
    const response = await fetch("https://api.identityiq.com/v2/credit-report", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "X-API-Secret": apiSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName: clientData.firstName,
        lastName: clientData.lastName,
        ssn4: clientData.ssnLast4,
        dateOfBirth: clientData.dob,
        addressLine1: clientData.address,
        city: clientData.city,
        state: clientData.state,
        postalCode: clientData.zip,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { score_eq: null, score_exp: null, score_tu: null, error: `API error: ${response.status}` };
    }

    const data = (await response.json()) as Record<string, unknown>;

    return {
      score_eq: typeof data.equifaxScore === "number" ? data.equifaxScore : null,
      score_exp: typeof data.experianScore === "number" ? data.experianScore : null,
      score_tu: typeof data.transunionScore === "number" ? data.transunionScore : null,
      raw_response: data,
    };
  } catch (err) {
    return { score_eq: null, score_exp: null, score_tu: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function testIdentityIQConnection(apiKey: string, apiSecret: string): Promise<{ ok: boolean; message: string }> {
  if (!apiKey.trim() || !apiSecret.trim()) {
    return { ok: false, message: "Enter both an API key and API secret." };
  }
  try {
    const response = await fetch("https://api.identityiq.com/v2/credit-report", {
      method: "POST",
      headers: { "X-API-Key": apiKey, "X-API-Secret": apiSecret, "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: "Credentials rejected by IdentityIQ." };
    }
    return { ok: true, message: "Reached IdentityIQ with these credentials." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not reach IdentityIQ." };
  }
}
