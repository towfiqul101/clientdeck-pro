import { getClientOr404 } from "@/lib/clients/queries";
import { ClientHeader } from "./client-header";
import { ClientTabs } from "./client-tabs";

export default async function ClientDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientOr404(id);

  return (
    <div className="space-y-6">
      <ClientHeader client={client} />
      <ClientTabs clientId={client.id} />
      <div>{children}</div>
    </div>
  );
}
