import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasApiAccess } from "@/lib/billing/plans";
import { Card } from "@/components/ui/card";
import { ApiKeysForm } from "./api-keys-form";
import type { AgencyApiKey } from "@/types";

export default async function ApiSettingsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const { agency } = session;

  if (!hasApiAccess(agency.plan)) {
    return (
      <Card className="p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06]">
          <Lock className="h-6 w-6 text-slate-500" />
        </span>
        <h2 className="mt-4 text-sm font-semibold text-slate-100">
          API Access — Available on Agency plan
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
          Generate API keys to access RoundTrack Pro data programmatically.
        </p>
        <Link
          href="/settings/billing"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Upgrade to Agency Plan →
        </Link>
      </Card>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("agency_api_keys")
    .select("*")
    .order("created_at", { ascending: false });

  return <ApiKeysForm initialKeys={(data ?? []) as AgencyApiKey[]} />;
}
