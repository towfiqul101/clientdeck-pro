import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { Card, CardHeader } from "@/components/ui/card";
import { TemplateForm } from "../template-form";

export default async function NewTemplatePage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Create Template" description="Build a custom AI letter template for your agency." />
        <div className="p-5">
          <TemplateForm />
        </div>
      </Card>
    </div>
  );
}
