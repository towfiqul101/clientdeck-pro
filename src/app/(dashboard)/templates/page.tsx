import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Card, CardHeader } from "@/components/ui/card";
import { LETTER_TYPES } from "@/lib/constants";
import { FileText, Sparkles } from "lucide-react";
import type { LetterTemplate } from "@/types";

const LETTER_TYPE_LABEL = new Map(LETTER_TYPES.map((t) => [t.value, t.label]));

export default async function TemplatesPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("letter_templates")
    .select("*")
    .eq("is_active", true)
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
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <FileText className="h-8 w-8 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">No templates found.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {templates.map((t) => (
              <li key={t.id} className="flex items-start gap-4 px-5 py-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900">{t.name}</p>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {LETTER_TYPE_LABEL.get(t.letter_type) ?? t.letter_type}
                    </span>
                    {t.is_system ? (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                        System
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        Custom
                      </span>
                    )}
                    {t.round_suggestion && (
                      <span className="text-xs text-gray-400">
                        Suggested for round {t.round_suggestion}
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <p className="mt-1 text-sm text-gray-500">{t.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
