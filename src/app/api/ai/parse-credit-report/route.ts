import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { parseCreditReport } from "@/lib/claude/parse-credit-report";
import type { Bureau } from "@/types";

export const maxDuration = 60;

const VALID_BUREAUS: Bureau[] = ["equifax", "experian", "transunion"];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid upload." }, { status: 400 });
  }

  const clientId = String(form.get("clientId") ?? "");
  const bureau = String(form.get("bureau") ?? "") as Bureau;
  const file = form.get("file");

  if (!clientId) return NextResponse.json({ ok: false, error: "Missing client." }, { status: 400 });
  if (!VALID_BUREAUS.includes(bureau)) {
    return NextResponse.json({ ok: false, error: "Select a bureau." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Attach a PDF." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ ok: false, error: "File must be a PDF." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "PDF exceeds 10MB." }, { status: 400 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const { items, note } = await parseCreditReport(base64, bureau);
    return NextResponse.json({ ok: true, items, note });
  } catch (e) {
    console.error("[parse-credit-report] failed:", e);
    return NextResponse.json(
      { ok: false, error: "Analysis failed. Try again or add items manually." },
      { status: 500 }
    );
  }
}
