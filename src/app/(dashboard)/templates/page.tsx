import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Card, CardHeader } from "@/components/ui/card";
import { TemplatesList } from "./templates-list";
import type { LetterTemplate } from "@/types";

export default async function TemplatesPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("letter_templates")
    .select("*")
    .order("is_system", { ascending: false })
    .order("name");
  const templates = (data ?? []) as LetterTemplate[];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Letter Templates"
          description="AI prompt templates used to generate dispute letters. System templates ship with ClientDeck Pro; custom templates are specific to your agency."
        />
        <div className="p-5">
          <TemplatesList templates={templates} />
        </div>
      </Card>
    </div>
  );
}
