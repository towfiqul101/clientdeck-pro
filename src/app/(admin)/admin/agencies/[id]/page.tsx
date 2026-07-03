import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardHeader } from "@/components/ui/card";
import { cn, formatDate, getStatusColor } from "@/lib/utils/helpers";
import { AgencyControls } from "./agency-controls";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Agency, ActivityLog } from "@/types";

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function AdminAgencyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data } = await admin.from("agencies").select("*").eq("id", id).single();
  if (!data) notFound();
  const agency = data as Agency;

  const [{ count: clientCount }, { data: activity }] = await Promise.all([
    admin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", id),
    admin
      .from("activity_log")
      .select("*")
      .eq("agency_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const activities = (activity ?? []) as ActivityLog[];

  const info: [string, string][] = [
    ["Owner", agency.owner_name],
    ["Email", agency.owner_email],
    ["Phone", agency.phone ?? "—"],
    ["Plan", agency.plan],
    ["Max clients", String(agency.max_clients)],
    ["License key", agency.license_key],
    ["GHL location", agency.ghl_location_id ?? "—"],
    ["Stripe customer", agency.stripe_customer_id ?? "—"],
    ["Trial ends", agency.trial_ends_at ? formatDate(agency.trial_ends_at) : "—"],
    ["Created", formatDate(agency.created_at)],
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/agencies"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        All agencies
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold text-gray-900">{agency.name}</h2>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
            getStatusColor(agency.plan_status)
          )}
        >
          {agency.plan_status.replace("_", " ")}
        </span>
      </div>

      <Card>
        <CardHeader
          title="Agency details"
          action={
            <Link
              href={`/admin/clients?agency=${agency.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {clientCount ?? 0} clients
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 p-5 sm:grid-cols-2">
          {info.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 text-sm">
              <dt className="text-gray-500">{label}</dt>
              <dd className="truncate font-medium capitalize text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <AgencyControls agency={agency} />

      <Card>
        <CardHeader title="Activity" description="Last 20 entries for this agency." />
        {activities.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-500">
            No activity recorded.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {activities.map((entry) => (
              <li key={entry.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{entry.action}</p>
                  <span className="shrink-0 text-xs text-gray-400">
                    {timeAgo(entry.created_at)}
                  </span>
                </div>
                {entry.description && (
                  <p className="mt-0.5 text-sm text-gray-500">{entry.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
