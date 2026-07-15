import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { API_RATE_LIMIT } from "@/lib/api/auth";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.com";

interface EndpointDoc {
  method: "GET" | "POST";
  path: string;
  title: string;
  description: string;
  curl: string;
  response: string;
}

const ENDPOINTS: EndpointDoc[] = [
  {
    method: "GET",
    path: "/api/v1/clients",
    title: "List clients",
    description:
      "Lists clients for your agency. Core fields plus the 10 Onboarding Details intake fields — no SSN, signature, or document fields. Supports limit/offset pagination (limit defaults to 50, max 100).",
    curl: `curl "${BASE_URL}/api/v1/clients?limit=50&offset=0" \\
  -H "Authorization: Bearer rtp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"`,
    response: `{
  "data": [
    {
      "id": "56092b3d-7777-47d2-8b0d-88a8f865bc49",
      "first_name": "Jane",
      "last_name": "Doe",
      "email": "jane@example.com",
      "phone": "5035551234",
      "status": "active",
      "assigned_to": "e1ed4241-7953-4f1f-b734-dd91d1f3a8c1",
      "current_round": 1,
      "credit_score_range": "580_669",
      "reviewed_credit_report_recently": true,
      "negative_items_reported": true,
      "enrolled_other_program": false,
      "primary_goal": "Buy a house next year",
      "results_timeline": "6_months",
      "employment_status": "employed",
      "bankruptcy_filed": false,
      "bankruptcy_date": null,
      "intake_concerns": "Worried about a collection account I don't recognize."
    }
  ],
  "pagination": { "limit": 50, "offset": 0, "total": 1 }
}`,
  },
  {
    method: "GET",
    path: "/api/v1/clients/:id",
    title: "Get a client",
    description:
      "Single client detail, same field scope as the list endpoint. Returns 404 for both a nonexistent id and one that belongs to a different agency — the response is identical either way, so a key can never confirm whether an id exists elsewhere.",
    curl: `curl "${BASE_URL}/api/v1/clients/56092b3d-7777-47d2-8b0d-88a8f865bc49" \\
  -H "Authorization: Bearer rtp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"`,
    response: `{
  "data": {
    "id": "56092b3d-7777-47d2-8b0d-88a8f865bc49",
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@example.com",
    "phone": "5035551234",
    "status": "active",
    "assigned_to": "e1ed4241-7953-4f1f-b734-dd91d1f3a8c1",
    "current_round": 1,
    "credit_score_range": "580_669",
    "reviewed_credit_report_recently": true,
    "negative_items_reported": true,
    "enrolled_other_program": false,
    "primary_goal": "Buy a house next year",
    "results_timeline": "6_months",
    "employment_status": "employed",
    "bankruptcy_filed": false,
    "bankruptcy_date": null,
    "intake_concerns": "Worried about a collection account I don't recognize."
  }
}`,
  },
  {
    method: "GET",
    path: "/api/v1/clients/:id/rounds",
    title: "Get a client's dispute rounds",
    description:
      "Round status summary for a client — counts and dates only, never letter content. 404s the same way the client-detail endpoint does when the client isn't in your agency.",
    curl: `curl "${BASE_URL}/api/v1/clients/56092b3d-7777-47d2-8b0d-88a8f865bc49/rounds" \\
  -H "Authorization: Bearer rtp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"`,
    response: `{
  "data": [
    {
      "round_number": 1,
      "status": "complete",
      "date_sent": "2026-05-23",
      "response_deadline": "2026-06-22",
      "date_responses_received": "2026-06-20",
      "total_items_disputed": 12,
      "total_deletions": 4,
      "total_updates": 1,
      "total_verified": 6,
      "total_no_response": 1
    },
    {
      "round_number": 2,
      "status": "awaiting_response",
      "date_sent": "2026-06-22",
      "response_deadline": "2026-07-22",
      "date_responses_received": null,
      "total_items_disputed": 7,
      "total_deletions": 0,
      "total_updates": 0,
      "total_verified": 0,
      "total_no_response": 0
    }
  ]
}`,
  },
  {
    method: "POST",
    path: "/api/v1/clients",
    title: "Create a client",
    description:
      "Creates a client. Only first_name and last_name are required, matching the dashboard's own new-client form. This is a minimal, fast, predictable create — it does not replicate the full GHL onboarding-webhook cascade (no Drive sync, portal-link generation, notification, pipeline-stage move, or credit-monitoring pull). If your agency has GoHighLevel connected, a contact is created there too by default (best-effort — set create_in_ghl: false to skip it).",
    curl: `curl -X POST "${BASE_URL}/api/v1/clients" \\
  -H "Authorization: Bearer rtp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@example.com",
    "phone": "5035551234"
  }'`,
    response: `{
  "data": {
    "id": "56092b3d-7777-47d2-8b0d-88a8f865bc49",
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@example.com",
    "phone": "5035551234",
    "status": "onboarding",
    "assigned_to": null,
    "current_round": 0,
    "credit_score_range": null,
    "reviewed_credit_report_recently": null,
    "negative_items_reported": null,
    "enrolled_other_program": null,
    "primary_goal": null,
    "results_timeline": null,
    "employment_status": null,
    "bankruptcy_filed": null,
    "bankruptcy_date": null,
    "intake_concerns": null
  },
  "ghl_warning": null
}`,
  },
];

const STATUS_CODES: { code: string; meaning: string; when: string }[] = [
  { code: "200", meaning: "OK", when: "Successful GET request." },
  { code: "201", meaning: "Created", when: "Client created successfully." },
  {
    code: "400",
    meaning: "Bad Request",
    when: "Missing required field (first_name/last_name) or invalid JSON body.",
  },
  {
    code: "401",
    meaning: "Unauthorized",
    when: "Authorization header missing, key doesn't match any active key, or the key has been revoked.",
  },
  {
    code: "402",
    meaning: "Payment Required",
    when: "Either your agency has reached its plan's active-client limit (on POST), or your agency is no longer entitled to API access at all — the plan was downgraded off Agency, or the subscription is cancelled/past_due/paused. Entitlement is re-checked on every request, so keys stop working as soon as the plan lapses. Kept distinct from 400: this isn't a validation error.",
  },
  {
    code: "404",
    meaning: "Not Found",
    when: "The client id doesn't exist, or belongs to a different agency. Both cases return the exact same response, by design.",
  },
  {
    code: "429",
    meaning: "Too Many Requests",
    when: `Rate limit exceeded (${API_RATE_LIMIT} requests/hour per key). The response body includes limit, current, and reset_at.`,
  },
  { code: "500", meaning: "Internal Server Error", when: "Unexpected server-side failure." },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-gray-900 px-3 py-2.5 font-mono text-xs leading-relaxed text-gray-100">
      <code>{children}</code>
    </pre>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/settings/api"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" /> Back to API Settings
        </Link>
        <h1 className="text-xl font-semibold text-slate-100">Agency API Reference</h1>
        <p className="mt-1 text-sm text-slate-500">
          Read/write access to your clients, scoped to your agency. Authenticate every
          request with{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs">
            Authorization: Bearer &lt;your key&gt;
          </code>
          . Generate a key on the{" "}
          <Link href="/settings/api" className="font-medium text-blue-400 hover:text-blue-400">
            API Settings
          </Link>{" "}
          page.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Rate limit"
          description={`Every key is limited to ${API_RATE_LIMIT} requests per hour, in fixed windows aligned to the clock hour (e.g. 2:00–3:00pm). Exceeding it returns 429 with the current count and when the window resets.`}
        />
      </Card>

      {ENDPOINTS.map((ep) => (
        <Card key={`${ep.method}-${ep.path}`}>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <span className="rounded bg-blue-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-blue-400">
                  {ep.method}
                </span>
                <code className="font-mono text-sm text-slate-100">{ep.path}</code>
              </span>
            }
            description={ep.title}
          />
          <div className="space-y-4 p-6 text-sm">
            <p className="text-slate-400">{ep.description}</p>
            <div>
              <p className="mb-1.5 font-medium text-slate-300">Request</p>
              <CodeBlock>{ep.curl}</CodeBlock>
            </div>
            <div>
              <p className="mb-1.5 font-medium text-slate-300">Response</p>
              <CodeBlock>{ep.response}</CodeBlock>
            </div>
          </div>
        </Card>
      ))}

      <Card>
        <CardHeader title="Status codes" />
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase text-slate-500">
              <tr>
                <th className="w-[12%] px-3 py-2 font-medium">Code</th>
                <th className="w-[22%] px-3 py-2 font-medium">Meaning</th>
                <th className="w-[66%] px-3 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {STATUS_CODES.map((s) => (
                <tr key={s.code}>
                  <td className="px-3 py-2 font-mono text-slate-100">{s.code}</td>
                  <td className="px-3 py-2 text-slate-300">{s.meaning}</td>
                  <td className="break-words px-3 py-2 text-slate-500">{s.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
