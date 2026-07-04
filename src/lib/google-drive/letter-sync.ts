import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateLetterPDF, type LetterPDFParams } from "@/lib/pdf/generate";
import { syncDocumentToDrive, type DriveAgency } from "./sync";
import {
  BUREAU_ADDRESSES,
  isCertifiedLetter,
  letterGoesToCreditor,
} from "@/lib/constants";
import type { Bureau, Client, LetterType } from "@/types";

interface DisputeRow {
  id: string;
  bureau: Bureau;
  letter_type: LetterType;
  letter_content: string | null;
  negative_item: { creditor_name: string } | null;
  client: Client | null;
}

const SELECT =
  "id, bureau, letter_type, letter_content, negative_item:negative_items(creditor_name), client:clients(*)";

/**
 * Regenerates each finalized letter PDF for a round and uploads them to Drive
 * under Round_{n}. Non-blocking / best-effort — always call from after() or a
 * .catch()-guarded promise so a Drive failure never breaks the round flow.
 */
export async function syncRoundLettersToDrive(
  agency: DriveAgency,
  roundId: string,
  roundNumber: number
): Promise<void> {
  if (!agency.google_drive_enabled || !agency.google_drive_refresh_token) return;

  const admin = createAdminClient();
  const { data } = await admin
    .from("disputes")
    .select(SELECT)
    .eq("round_id", roundId)
    .not("letter_content", "is", null);

  const disputes = (data ?? []) as unknown as DisputeRow[];
  const client = disputes.find((d) => d.client)?.client;
  if (disputes.length === 0 || !client) return;

  const clientName = `${client.first_name} ${client.last_name}`;
  const clientAddress = [
    client.address_line1,
    client.address_line2,
    [client.city, client.state, client.zip].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("\n");

  for (const d of disputes) {
    try {
      const toCreditor = letterGoesToCreditor(d.letter_type);
      const params: LetterPDFParams = {
        letterContent: d.letter_content ?? "",
        certified: isCertifiedLetter(d.letter_type),
        clientName,
        clientAddress,
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

      const buffer = await generateLetterPDF(params);
      const bureauLabel = d.bureau.charAt(0).toUpperCase() + d.bureau.slice(1);
      const creditor = (d.negative_item?.creditor_name ?? "Unknown").replace(
        /[^a-zA-Z0-9]/g,
        "_"
      );

      await syncDocumentToDrive(agency, {
        clientName,
        subFolder: `Round_${roundNumber}`,
        fileName: `${bureauLabel}_Dispute_${creditor}.pdf`,
        fileBuffer: buffer,
        mimeType: "application/pdf",
      });

      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error("[Drive] Letter sync failed:", err);
    }
  }
}
