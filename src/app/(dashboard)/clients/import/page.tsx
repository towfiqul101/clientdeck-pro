import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { checkClientLimit } from "@/lib/utils/license";
import { Card, CardHeader } from "@/components/ui/card";
import { ImportWizard } from "./import-wizard";

export default async function ImportClientsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const limit = await checkClientLimit(session.agency.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader
          title="Import Clients"
          description={`Upload a CSV to bulk-add clients. Currently at ${limit.current} of ${limit.max} active clients on your plan.`}
        />
        <div className="px-5 py-5">
          <ImportWizard />
        </div>
      </Card>
    </div>
  );
}
