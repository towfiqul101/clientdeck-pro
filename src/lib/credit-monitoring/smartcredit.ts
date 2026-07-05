import type { ClientData, ScorePullResult } from "./myfreescorenow";

// TODO: Verify endpoint URL with SmartCredit's white-label reseller API docs.
export async function pullSmartCredit(
  apiKey: string,
  apiSecret: string,
  clientData: ClientData
): Promise<ScorePullResult> {
  try {
    const response = await fetch("https://api.smartcredit.com/v1/reports", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "X-Api-Secret": apiSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        first_name: clientData.firstName,
        last_name: clientData.lastName,
        ssn_last_4: clientData.ssnLast4,
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
      score_eq: typeof data.scores === "object" && data.scores !== null && "equifax" in data.scores ? Number(data.scores.equifax) || null : null,
      score_exp: typeof data.scores === "object" && data.scores !== null && "experian" in data.scores ? Number(data.scores.experian) || null : null,
      score_tu: typeof data.scores === "object" && data.scores !== null && "transunion" in data.scores ? Number(data.scores.transunion) || null : null,
      raw_response: data,
    };
  } catch (err) {
    return { score_eq: null, score_exp: null, score_tu: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function testSmartCreditConnection(apiKey: string, apiSecret: string): Promise<{ ok: boolean; message: string }> {
  if (!apiKey.trim() || !apiSecret.trim()) {
    return { ok: false, message: "Enter both an API key and API secret." };
  }
  try {
    const response = await fetch("https://api.smartcredit.com/v1/reports", {
      method: "POST",
      headers: { "X-Api-Key": apiKey, "X-Api-Secret": apiSecret, "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: "Credentials rejected by SmartCredit." };
    }
    return { ok: true, message: "Reached SmartCredit with these credentials." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not reach SmartCredit." };
  }
}
