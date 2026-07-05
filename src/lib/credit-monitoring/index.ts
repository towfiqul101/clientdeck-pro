import type { CreditMonitoringService } from "@/types";
import { pullMyFreeScoreNow, testMyFreeScoreNowConnection } from "./myfreescorenow";
import { pullIdentityIQ, testIdentityIQConnection } from "./identityiq";
import { pullSmartCredit, testSmartCreditConnection } from "./smartcredit";
import type { ClientData, ScorePullResult } from "./myfreescorenow";

export type { ClientData, ScorePullResult };

export async function pullCreditScores(
  service: CreditMonitoringService,
  apiKey: string,
  apiSecret: string,
  clientData: ClientData
): Promise<ScorePullResult> {
  switch (service) {
    case "myfreescorenow":
      return pullMyFreeScoreNow(apiKey, apiSecret, clientData);
    case "identityiq":
      return pullIdentityIQ(apiKey, apiSecret, clientData);
    case "smartcredit":
      return pullSmartCredit(apiKey, apiSecret, clientData);
    default:
      return { score_eq: null, score_exp: null, score_tu: null, error: "Unknown service" };
  }
}

export async function testConnection(
  service: CreditMonitoringService,
  apiKey: string,
  apiSecret: string
): Promise<{ ok: boolean; message: string }> {
  switch (service) {
    case "myfreescorenow":
      return testMyFreeScoreNowConnection(apiKey, apiSecret);
    case "identityiq":
      return testIdentityIQConnection(apiKey, apiSecret);
    case "smartcredit":
      return testSmartCreditConnection(apiKey, apiSecret);
    default:
      return { ok: false, message: "Unknown service" };
  }
}
