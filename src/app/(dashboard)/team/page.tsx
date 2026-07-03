import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Card, CardHeader } from "@/components/ui/card";
import { getInitials } from "@/lib/utils/helpers";
import { Users } from "lucide-react";
import type { TeamMember } from "@/types";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
  viewer: "Viewer",
};

export default async function TeamPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("team_members")
    .select("*")
    .order("created_at", { ascending: true });
  const members = (data ?? []) as TeamMember[];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Team"
          description="Staff who can access this agency's workspace."
        />
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Users className="h-8 w-8 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">No team members yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-4 px-5 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-800 text-sm font-medium text-white">
                  {getInitials(
                    m.name.split(" ")[0] ?? m.name,
                    m.name.split(" ")[1] ?? ""
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{m.name}</p>
                  <p className="truncate text-sm text-gray-500">{m.email}</p>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-gray-700">
                  {ROLE_LABEL[m.role] ?? m.role}
                </span>
                {!m.is_active && (
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                    Inactive
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
