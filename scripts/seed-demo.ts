/**
 * ClientDeck Pro — demo data seeder.
 *
 * Creates a complete, previewable demo agency ("Jetlag Recovery") with a staff
 * login, 5 realistic clients, negative items, dispute rounds + disputes, score
 * history, and an activity timeline. Idempotent: re-running wipes the previous
 * demo agency (by owner email) and its auth user, then recreates everything.
 *
 * Run:  npx tsx scripts/seed-demo.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (read from
 * .env.local automatically — no dotenv dependency needed).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Env loading (tiny .env.local parser so `npx tsx scripts/seed-demo.ts` works)
// ---------------------------------------------------------------------------
function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env.local optional — env may already be exported
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "\n❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "   Add them to .env.local, then re-run: npx tsx scripts/seed-demo.ts\n"
  );
  process.exit(1);
}

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_EMAIL = "demo@clientdeckpro.com";
const DEMO_PASSWORD = "Demo1234!";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
/** ISO date (YYYY-MM-DD) offset by n days from today (negative = past). */
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
/** Full ISO timestamp offset by n days from now. */
function tsOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Bureau addresses for mock letter content
// ---------------------------------------------------------------------------
const BUREAU_ADDRESSES: Record<string, string> = {
  equifax: "Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374-0256",
  experian: "Experian\nP.O. Box 4500\nAllen, TX 75013",
  transunion: "TransUnion LLC\nConsumer Dispute Center\nP.O. Box 2000\nChester, PA 19016",
};

function mockLetter(client: ClientSeed, item: ItemSeed): string {
  return `${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}

${BUREAU_ADDRESSES[item.bureau]}

RE: Dispute of Inaccurate Information — ${item.creditor_name} (Account ending ${item.account_number_last4})

To Whom It May Concern:

I am writing pursuant to my rights under the Fair Credit Reporting Act (FCRA), 15 U.S.C. § 1681 et seq., to dispute inaccurate information appearing on my credit report.

My name is ${client.first_name} ${client.last_name} and I reside at ${client.address_line1}, ${client.city}, ${client.state} ${client.zip}.

I am disputing the following account which is being reported inaccurately:

Creditor: ${item.creditor_name}
Reported Issue: ${item.negative_type.replace(/_/g, " ").toUpperCase()}

Please investigate this matter pursuant to Section 611 of the FCRA (15 U.S.C. § 1681i) and delete it if it cannot be verified.

Sincerely,

${client.first_name} ${client.last_name}

[PREVIEW LETTER — seeded demo data]`;
}

// ---------------------------------------------------------------------------
// Seed data definitions
// ---------------------------------------------------------------------------
type Bureau = "equifax" | "experian" | "transunion";

interface ItemSeed {
  bureau: Bureau;
  creditor_name: string;
  account_number_last4: string;
  account_type: string;
  negative_type: string;
  balance: number | null;
  deleted: boolean;
}

interface ClientSeed {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  ssn_last4: string;
  credit_goal: string;
  status: string;
  monthly_fee: number;
  payment_status: string;
  current_round: number;
  scores_start: [number, number, number]; // eq, exp, tu
  scores_current: [number, number, number];
  score_goal: number;
  items: ItemSeed[];
  /** Round definitions in chronological order. */
  rounds: RoundSeed[];
  /** Extra score-history points beyond start (chronological). */
  scoreHistory: { offsetDays: number; scores: [number, number, number]; round: number | null; notes: string }[];
}

interface RoundSeed {
  round_number: number;
  status: "preparing" | "letters_generated" | "sent" | "awaiting_response" | "complete";
  sentOffset: number | null; // days from now
  deadlineOffset: number | null;
  responseOffset: number | null;
  itemsDisputed: number; // number of items included this round
  deletions: number;
  updates: number;
  verified: number;
  noResponse: number;
}

const CREDITORS: [string, string, string][] = [
  // creditor, account_type, negative_type
  ["Midland Funding LLC", "collection", "collection"],
  ["Portfolio Recovery Assoc", "collection", "collection"],
  ["LVNV Funding LLC", "collection", "collection"],
  ["Capital One Bank", "credit_card", "charge_off"],
  ["Credit One Bank", "credit_card", "late_payment"],
  ["Synchrony Bank", "credit_card", "charge_off"],
  ["Comenity Bank", "credit_card", "late_payment"],
  ["Cavalry SPV I LLC", "collection", "collection"],
  ["Convergent Outsourcing", "collection", "collection"],
  ["Santander Consumer USA", "auto_loan", "repossession"],
  ["IC System Inc", "collection", "collection"],
  ["Jefferson Capital", "collection", "collection"],
  ["Enhanced Recovery Co", "collection", "collection"],
  ["Wells Fargo", "auto_loan", "late_payment"],
  ["Medical Data Systems", "medical", "collection"],
];
const BUREAUS: Bureau[] = ["equifax", "experian", "transunion"];

function makeItems(count: number, deletedCount: number): ItemSeed[] {
  const items: ItemSeed[] = [];
  for (let i = 0; i < count; i++) {
    const [creditor, accountType, negType] = CREDITORS[i % CREDITORS.length];
    items.push({
      bureau: BUREAUS[i % 3],
      creditor_name: creditor,
      account_number_last4: String(1000 + ((i * 137) % 9000)).slice(-4),
      account_type: accountType,
      negative_type: negType,
      balance:
        negType === "late_payment" ? null : Math.round((300 + i * 271) % 4800) + 120,
      deleted: i < deletedCount,
    });
  }
  return items;
}

const CLIENTS: ClientSeed[] = [
  {
    first_name: "Marcus",
    last_name: "Johnson",
    email: "marcus.johnson@example.com",
    phone: "(404) 555-0142",
    address_line1: "1847 Peachtree St NE",
    city: "Atlanta",
    state: "GA",
    zip: "30309",
    ssn_last4: "4821",
    credit_goal: "buy_home",
    status: "active",
    monthly_fee: 149,
    payment_status: "active",
    current_round: 3,
    scores_start: [580, 565, 572],
    scores_current: [642, 635, 648],
    score_goal: 700,
    items: makeItems(8, 5),
    rounds: [
      { round_number: 1, status: "complete", sentOffset: -90, deadlineOffset: -60, responseOffset: -62, itemsDisputed: 8, deletions: 2, updates: 1, verified: 4, noResponse: 1 },
      { round_number: 2, status: "complete", sentOffset: -55, deadlineOffset: -25, responseOffset: -28, itemsDisputed: 6, deletions: 2, updates: 0, verified: 3, noResponse: 1 },
      { round_number: 3, status: "complete", sentOffset: -20, deadlineOffset: 10, responseOffset: -2, itemsDisputed: 3, deletions: 1, updates: 1, verified: 1, noResponse: 0 },
    ],
    scoreHistory: [
      { offsetDays: -60, scores: [604, 592, 600], round: 1, notes: "After Round 1 results" },
      { offsetDays: -28, scores: [628, 618, 630], round: 2, notes: "After Round 2 results" },
      { offsetDays: -2, scores: [642, 635, 648], round: 3, notes: "After Round 3 results" },
    ],
  },
  {
    first_name: "Jennifer",
    last_name: "Williams",
    email: "jennifer.williams@example.com",
    phone: "(305) 555-0198",
    address_line1: "920 Brickell Ave Apt 4B",
    city: "Miami",
    state: "FL",
    zip: "33131",
    ssn_last4: "7733",
    credit_goal: "lower_rates",
    status: "active",
    monthly_fee: 149,
    payment_status: "active",
    current_round: 2,
    scores_start: [510, 498, 522],
    scores_current: [554, 548, 560],
    score_goal: 640,
    items: makeItems(12, 4),
    rounds: [
      { round_number: 1, status: "complete", sentOffset: -50, deadlineOffset: -20, responseOffset: -22, itemsDisputed: 12, deletions: 4, updates: 1, verified: 6, noResponse: 1 },
      { round_number: 2, status: "awaiting_response", sentOffset: -20, deadlineOffset: 10, responseOffset: null, itemsDisputed: 7, deletions: 0, updates: 0, verified: 0, noResponse: 0 },
    ],
    scoreHistory: [
      { offsetDays: -22, scores: [554, 548, 560], round: 1, notes: "After Round 1 results" },
    ],
  },
  {
    first_name: "David",
    last_name: "Chen",
    email: "david.chen@example.com",
    phone: "(415) 555-0176",
    address_line1: "455 Market St Unit 12",
    city: "San Francisco",
    state: "CA",
    zip: "94105",
    ssn_last4: "3390",
    credit_goal: "get_approved",
    status: "completed",
    monthly_fee: 149,
    payment_status: "active",
    current_round: 3,
    scores_start: [620, 610, 605],
    scores_current: [680, 672, 685],
    score_goal: 680,
    items: makeItems(6, 6),
    rounds: [
      { round_number: 1, status: "complete", sentOffset: -85, deadlineOffset: -55, responseOffset: -57, itemsDisputed: 6, deletions: 3, updates: 0, verified: 3, noResponse: 0 },
      { round_number: 2, status: "complete", sentOffset: -50, deadlineOffset: -20, responseOffset: -22, itemsDisputed: 3, deletions: 2, updates: 0, verified: 1, noResponse: 0 },
      { round_number: 3, status: "complete", sentOffset: -18, deadlineOffset: 12, responseOffset: -5, itemsDisputed: 1, deletions: 1, updates: 0, verified: 0, noResponse: 0 },
    ],
    scoreHistory: [
      { offsetDays: -55, scores: [645, 636, 640], round: 1, notes: "After Round 1 results" },
      { offsetDays: -22, scores: [668, 660, 672], round: 2, notes: "After Round 2 results" },
      { offsetDays: -5, scores: [680, 672, 685], round: 3, notes: "Goal achieved 🎉" },
    ],
  },
  {
    first_name: "Sarah",
    last_name: "Thompson",
    email: "sarah.thompson@example.com",
    phone: "(214) 555-0133",
    address_line1: "3300 Oak Lawn Ave",
    city: "Dallas",
    state: "TX",
    zip: "75219",
    ssn_last4: "1204",
    credit_goal: "improve_general",
    status: "active",
    monthly_fee: 149,
    payment_status: "active",
    current_round: 1,
    scores_start: [490, 502, 488],
    scores_current: [490, 502, 488],
    score_goal: 620,
    items: makeItems(15, 0),
    rounds: [
      { round_number: 1, status: "sent", sentOffset: -2, deadlineOffset: 28, responseOffset: null, itemsDisputed: 15, deletions: 0, updates: 0, verified: 0, noResponse: 0 },
    ],
    scoreHistory: [],
  },
  {
    first_name: "Robert",
    last_name: "Garcia",
    email: "robert.garcia@example.com",
    phone: "(602) 555-0119",
    address_line1: "2201 E Camelback Rd",
    city: "Phoenix",
    state: "AZ",
    zip: "85016",
    ssn_last4: "9567",
    credit_goal: "car_loan",
    status: "onboarding",
    monthly_fee: 99,
    payment_status: "pending",
    current_round: 0,
    scores_start: [545, 538, 551],
    scores_current: [545, 538, 551],
    score_goal: 640,
    items: makeItems(10, 0),
    rounds: [],
    scoreHistory: [],
  },
];

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------
async function ensureAuthUser(): Promise<string> {
  // Remove any existing demo user first so the run is idempotent.
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);
  if (existing) {
    await admin.auth.admin.deleteUser(existing.id);
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Failed to create auth user: ${error?.message}`);
  }
  return data.user.id;
}

async function wipeExistingAgency() {
  // Cascade deletes clients/items/rounds/disputes/score_history/activity.
  const { data } = await admin
    .from("agencies")
    .select("id")
    .eq("owner_email", DEMO_EMAIL);
  for (const row of data ?? []) {
    await admin.from("agencies").delete().eq("id", row.id);
  }
}

async function seed() {
  console.log("→ Creating demo auth user…");
  const userId = await ensureAuthUser();

  console.log("→ Wiping any previous demo agency…");
  await wipeExistingAgency();

  console.log("→ Creating agency (Jetlag Recovery)…");
  const { data: agency, error: agencyErr } = await admin
    .from("agencies")
    .insert({
      name: "Jetlag Recovery",
      owner_name: "Durayveon Williams",
      owner_email: DEMO_EMAIL,
      owner_user_id: userId,
      phone: "(770) 555-0100",
      brand_color: "#1D4ED8",
      plan: "pro",
      plan_status: "active",
      max_clients: 75,
      settings: {
        timezone: "America/New_York",
        letter_signature: "Durayveon Williams — Jetlag Recovery",
        default_monthly_fee: 149,
        portal_branding_visible: true,
        onboarding_completed: true,
        onboarding_steps: {
          ghl_connected: true,
          first_client_added: true,
          snapshot_installed: true,
          test_portal_viewed: true,
        },
      },
    })
    .select("id")
    .single();
  if (agencyErr || !agency) throw new Error(`Agency insert failed: ${agencyErr?.message}`);
  const agencyId = agency.id as string;

  console.log("→ Creating owner team member…");
  await admin.from("team_members").insert({
    agency_id: agencyId,
    user_id: userId,
    name: "Durayveon Williams",
    email: DEMO_EMAIL,
    role: "owner",
    is_active: true,
  });

  const portalLinks: { name: string; token: string }[] = [];

  for (const c of CLIENTS) {
    console.log(`→ Client: ${c.first_name} ${c.last_name}`);
    const totalDeleted = c.items.filter((i) => i.deleted).length;
    const { data: client, error: clientErr } = await admin
      .from("clients")
      .insert({
        agency_id: agencyId,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        phone: c.phone,
        address_line1: c.address_line1,
        city: c.city,
        state: c.state,
        zip: c.zip,
        ssn_last4: c.ssn_last4,
        credit_goal: c.credit_goal,
        status: c.status,
        monthly_fee: c.monthly_fee,
        payment_status: c.payment_status,
        service_start_date: dateOffset(-95),
        current_round: c.current_round,
        score_eq_start: c.scores_start[0],
        score_exp_start: c.scores_start[1],
        score_tu_start: c.scores_start[2],
        score_eq_current: c.scores_current[0],
        score_exp_current: c.scores_current[1],
        score_tu_current: c.scores_current[2],
        score_goal: c.score_goal,
        total_items_start: c.items.length,
        total_items_current: c.items.length - totalDeleted,
        total_items_deleted: totalDeleted,
        referral_source: "GoHighLevel",
      })
      .select("id, portal_token")
      .single();
    if (clientErr || !client) throw new Error(`Client insert failed: ${clientErr?.message}`);
    const clientId = client.id as string;
    portalLinks.push({ name: `${c.first_name} ${c.last_name}`, token: client.portal_token as string });

    // Negative items
    const { data: insertedItems, error: itemErr } = await admin
      .from("negative_items")
      .insert(
        c.items.map((it) => ({
          client_id: clientId,
          agency_id: agencyId,
          bureau: it.bureau,
          creditor_name: it.creditor_name,
          account_number_last4: it.account_number_last4,
          account_type: it.account_type,
          negative_type: it.negative_type,
          balance: it.balance,
          date_opened: dateOffset(-800 - Math.floor(Math.random() * 400)),
          dispute_status: it.deleted ? "deleted" : c.current_round > 0 ? "in_dispute" : "not_disputed",
          round_disputed: c.current_round > 0 ? 1 : null,
          round_resolved: it.deleted ? 1 : null,
        }))
      )
      .select("id");
    if (itemErr) throw new Error(`Items insert failed: ${itemErr.message}`);
    const itemIds = (insertedItems ?? []).map((r) => r.id as string);

    // Rounds + disputes
    for (const r of c.rounds) {
      const { data: round, error: roundErr } = await admin
        .from("dispute_rounds")
        .insert({
          client_id: clientId,
          agency_id: agencyId,
          round_number: r.round_number,
          status: r.status,
          date_sent: r.sentOffset !== null ? dateOffset(r.sentOffset) : null,
          response_deadline: r.deadlineOffset !== null ? dateOffset(r.deadlineOffset) : null,
          date_responses_received: r.responseOffset !== null ? dateOffset(r.responseOffset) : null,
          total_items_disputed: r.itemsDisputed,
          total_deletions: r.deletions,
          total_updates: r.updates,
          total_verified: r.verified,
          total_no_response: r.noResponse,
        })
        .select("id")
        .single();
      if (roundErr || !round) throw new Error(`Round insert failed: ${roundErr?.message}`);
      const roundId = round.id as string;

      // Create disputes for the items included in this round.
      const roundItemCount = Math.min(r.itemsDisputed, itemIds.length);
      const disputes = [];
      for (let i = 0; i < roundItemCount; i++) {
        const seedItem = c.items[i];
        const finalized = r.status !== "preparing";
        // Distribute results to roughly match the round totals.
        let result = "pending";
        if (r.status === "complete") {
          if (i < r.deletions) result = "deleted";
          else if (i < r.deletions + r.updates) result = "updated";
          else if (i < r.deletions + r.updates + r.verified) result = "verified";
          else result = "no_response";
        } else if (r.status === "sent" || r.status === "awaiting_response") {
          result = "in_progress";
        }
        disputes.push({
          round_id: roundId,
          client_id: clientId,
          agency_id: agencyId,
          negative_item_id: itemIds[i],
          bureau: seedItem.bureau,
          letter_type: "initial_dispute",
          letter_content: mockLetter(c, seedItem),
          is_finalized: finalized,
          finalized_at: finalized && r.sentOffset !== null ? tsOffset(r.sentOffset) : null,
          result,
          result_date: r.responseOffset !== null && result !== "pending" && result !== "in_progress" ? dateOffset(r.responseOffset) : null,
        });
      }
      if (disputes.length) {
        const { error: dErr } = await admin.from("disputes").insert(disputes);
        if (dErr) throw new Error(`Disputes insert failed: ${dErr.message}`);
      }

      // Activity for the round
      await admin.from("activity_log").insert({
        agency_id: agencyId,
        client_id: clientId,
        actor_type: "staff",
        action: `Round ${r.round_number} ${r.status === "complete" ? "completed" : "sent"}`,
        description:
          r.status === "complete"
            ? `Round ${r.round_number} results logged — ${r.deletions} deletion(s).`
            : `Round ${r.round_number} letters sent to bureaus.`,
        created_at: r.sentOffset !== null ? tsOffset(r.sentOffset) : tsOffset(-1),
      });
    }

    // Baseline score history at service start
    await admin.from("score_history").insert({
      client_id: clientId,
      agency_id: agencyId,
      score_eq: c.scores_start[0],
      score_exp: c.scores_start[1],
      score_tu: c.scores_start[2],
      recorded_at: tsOffset(-95),
      round_number: 0,
      notes: "Starting scores at intake",
    });
    for (const h of c.scoreHistory) {
      await admin.from("score_history").insert({
        client_id: clientId,
        agency_id: agencyId,
        score_eq: h.scores[0],
        score_exp: h.scores[1],
        score_tu: h.scores[2],
        recorded_at: tsOffset(h.offsetDays),
        round_number: h.round,
        notes: h.notes,
      });
    }

    // Client-created activity
    await admin.from("activity_log").insert({
      agency_id: agencyId,
      client_id: clientId,
      actor_type: "system",
      action: "Client onboarded",
      description: `${c.first_name} ${c.last_name} added from GoHighLevel.`,
      created_at: tsOffset(-95),
    });
  }

  // Print summary
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  console.log("\n✅ Demo account created!\n");
  console.log("Staff login:     " + `${appUrl}/login`);
  console.log("Email:           " + DEMO_EMAIL);
  console.log("Password:        " + DEMO_PASSWORD);
  console.log("\nPortal previews:");
  for (const p of portalLinks) {
    console.log(`  ${p.name.padEnd(20)} ${appUrl}/portal?token=${p.token}`);
  }
  console.log("");
}

seed().catch((e) => {
  console.error("\n❌ Seed failed:", e);
  process.exit(1);
});
