import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  generateLetterPDF,
  generateRoundPDF,
  type LetterPDFParams,
} from "@/lib/pdf/generate";
import { BUREAU_ADDRESSES, isCertifiedLetter, letterGoesToCreditor } from "@/lib/constants";
import type { Bureau, Client, LetterType } from "@/types";

export const maxDuration = 120;

interface DisputeForPDF {
  id: string;
  bureau: Bureau;
  letter_type: LetterType;
  letter_content: string | null;
  negative_item: { creditor_name: string } | null;
  client: Client | null;
}

function clientAddress(client: Client | null): string {
  if (!client) return "";
  return [
    client.address_line1,
    client.address_line2,
    [client.city, client.state, client.zip].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("\n");
}

function toParams(d: DisputeForPDF): LetterPDFParams {
  const toCreditor = letterGoesToCreditor(d.letter_type);
  return {
    letterContent: d.letter_content ?? "",
    certified: isCertifiedLetter(d.letter_type),
    clientName: d.client
      ? `${d.client.first_name} ${d.client.last_name}`
      : "",
    clientAddress: clientAddress(d.client),
    bureauName: toCreditor
      ? d.negative_item?.creditor_name ?? ""
      : d.bureau.charAt(0).toUpperCase() + d.bureau.slice(1),
    bureauAddress: toCreditor ? "" : BUREAU_ADDRESSES[d.bureau],
    date: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };
}

const SELECT =
  "id, bureau, letter_type, letter_content, negative_item:negative_items(creditor_name), client:clients(*)";

function pdfResponse(buffer: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(req: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const disputeId = url.searchParams.get("disputeId");
  const roundId = url.searchParams.get("roundId");
  const supabase = await createServerSupabaseClient();

  if (disputeId) {
    const { data } = await supabase
      .from("disputes")
      .select(SELECT)
      .eq("id", disputeId)
      .single();
    const dispute = data as unknown as DisputeForPDF | null;
    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }
    if (!dispute.letter_content) {
      return NextResponse.json(
        { error: "This letter has not been generated yet." },
        { status: 400 }
      );
    }
    const buffer = await generateLetterPDF(toParams(dispute));
    const creditor =
      dispute.negative_item?.creditor_name?.replace(/[^\w]/g, "_") ?? "letter";
    return pdfResponse(buffer, `${creditor}-${dispute.bureau}.pdf`);
  }

  if (roundId) {
    const { data } = await supabase
      .from("disputes")
      .select(SELECT)
      .eq("round_id", roundId)
      .not("letter_content", "is", null)
      .order("bureau", { ascending: true });

    const disputes = (data ?? []) as unknown as DisputeForPDF[];
    if (disputes.length === 0) {
      return NextResponse.json(
        { error: "No generated letters in this round yet." },
        { status: 400 }
      );
    }
    const buffer = await generateRoundPDF(disputes.map(toParams));
    return pdfResponse(buffer, `round-letters.pdf`);
  }

  return NextResponse.json(
    { error: "Provide disputeId or roundId" },
    { status: 400 }
  );
}
