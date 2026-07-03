import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils/helpers";
import type { GhlSyncLog } from "@/types";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  sync_round_sent: "Round sent",
  sync_deletion: "Deletion",
  sync_score_update: "Score update",
  sync_completed: "Client completed",
};

function timestamp(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export async function GHLSyncActivity() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("ghl_sync_log")
    .select("*")
    .order("attempted_at", { ascending: false })
    .limit(20);

  const logs = (data ?? []) as GhlSyncLog[];

  return (
    <Card className="mt-6">
      <CardHeader
        title="Recent sync activity"
        description="The last 20 outbound syncs to GoHighLevel."
      />
      {logs.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-gray-500">
          No syncs yet. Sync events fire when you send a round, log deletions, or
          complete a client.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {logs.map((log) => {
            const failed = log.status === "failed";
            const retrying = log.status === "retrying";
            return (
              <li key={log.id} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-0.5 shrink-0">
                  {failed ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : retrying ? (
                    <RefreshCw className="h-4 w-4 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {ACTION_LABELS[log.sync_action] ?? log.sync_action}
                  </p>
                  {failed && log.error_message && (
                    <p className="truncate text-xs text-red-600">
                      {log.error_message}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      failed
                        ? "bg-red-50 text-red-700"
                        : retrying
                          ? "bg-amber-50 text-amber-700"
                          : "bg-green-50 text-green-700"
                    )}
                  >
                    {log.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {timestamp(log.attempted_at)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
