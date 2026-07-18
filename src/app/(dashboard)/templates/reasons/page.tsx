import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Card, CardHeader } from "@/components/ui/card";
import { ReasonsManager } from "./reasons-manager";
import type { DisputeReason, DisputeInstruction } from "@/types";

export default async function DisputeReasonsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const [reasonsRes, instructionsRes] = await Promise.all([
    supabase
      .from("dispute_reasons")
      .select("*")
      .eq("is_active", true)
      .order("is_system", { ascending: false })
      .order("sort_order"),
    supabase
      .from("dispute_instructions")
      .select("*")
      .eq("is_active", true)
      .order("is_system", { ascending: false })
      .order("sort_order"),
  ]);

  return (
    <Card>
      <CardHeader
        title="Dispute Reasons & Instructions"
        description="Standard reasons and instructions injected into every dispute letter. System defaults ship with RoundTrack Pro; add your own custom entries below."
      />
      <div className="p-5">
        <ReasonsManager
          reasons={(reasonsRes.data ?? []) as DisputeReason[]}
          instructions={(instructionsRes.data ?? []) as DisputeInstruction[]}
        />
      </div>
    </Card>
  );
}
