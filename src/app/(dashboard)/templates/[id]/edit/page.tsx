import { redirect, notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Card, CardHeader } from "@/components/ui/card";
import { TemplateForm } from "../../template-form";
import type { LetterTemplate } from "@/types";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("letter_templates").select("*").eq("id", id).single();
  if (!data) notFound();
  const template = data as LetterTemplate;
  if (template.is_system || template.agency_id !== session.agency.id) notFound();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Edit Template" description={template.name} />
        <div className="p-5">
          <TemplateForm template={template} />
        </div>
      </Card>
    </div>
  );
}
