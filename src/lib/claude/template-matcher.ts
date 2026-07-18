import { createAdminClient } from "@/lib/supabase/admin";
import type { LetterTemplate, TemplateKind } from "@/types";

/**
 * Resolves the best letter template for a given item + letter type.
 *
 * Priority (first match wins):
 *   1. Agency custom template — exact negative_type + letter_type
 *   2. Agency custom template — letter_type only (negative_type IS NULL, generic)
 *   3. System template        — exact negative_type + letter_type
 *   4. System template        — letter_type only (negative_type IS NULL, generic)
 *   5. System template        — any negative_type for that letter_type
 *   6. System template        — any initial_dispute (last-resort baseline)
 *
 * All of the above is additionally scoped to the requested `kind`
 * ('ai_prompt' or 'agency_static') — an agency_static request never
 * matches an ai_prompt template and vice versa.
 *
 * Returns null only if the templates table is empty for that type entirely.
 * Uses the service-role client so it can read system templates (agency_id NULL)
 * regardless of the caller's RLS context.
 */
export async function findBestTemplate(
  agencyId: string,
  negativeType: string,
  letterType: string,
  kind: TemplateKind = "ai_prompt"
): Promise<LetterTemplate | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("letter_templates")
    .select("*")
    .eq("is_active", true)
    .eq("kind", kind)
    .or(`agency_id.eq.${agencyId},agency_id.is.null`);

  const templates = (data ?? []) as LetterTemplate[];
  if (templates.length === 0) return null;

  const isAgency = (t: LetterTemplate) => t.agency_id === agencyId;
  const isSystem = (t: LetterTemplate) => t.agency_id === null;

  // 1. Agency custom, exact match
  const agencyExact = templates.find(
    (t) =>
      isAgency(t) &&
      t.letter_type === letterType &&
      t.negative_type === negativeType
  );
  if (agencyExact) return agencyExact;

  // 2. Agency custom, generic (negative_type NULL) for this letter type
  const agencyGeneric = templates.find(
    (t) => isAgency(t) && t.letter_type === letterType && t.negative_type === null
  );
  if (agencyGeneric) return agencyGeneric;

  // 3. System, exact match
  const systemExact = templates.find(
    (t) =>
      isSystem(t) &&
      t.letter_type === letterType &&
      t.negative_type === negativeType
  );
  if (systemExact) return systemExact;

  // 4. System, generic (negative_type NULL) for this letter type
  const systemGeneric = templates.find(
    (t) => isSystem(t) && t.letter_type === letterType && t.negative_type === null
  );
  if (systemGeneric) return systemGeneric;

  // 5. System, any negative_type for this letter type
  const systemAnyType = templates.find(
    (t) => isSystem(t) && t.letter_type === letterType
  );
  if (systemAnyType) return systemAnyType;

  // 6. Absolute fallback: any system initial_dispute template
  const baseline = templates.find(
    (t) => isSystem(t) && t.letter_type === "initial_dispute"
  );
  return baseline ?? null;
}
