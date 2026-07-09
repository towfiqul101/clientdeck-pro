import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { PlanCards } from "./plan-cards";

export default async function PlanSelectionPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-100">
          Choose your plan
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Every plan starts with a 14-day free trial. No credit card charged
          today — cancel anytime.
        </p>
      </div>

      <PlanCards billingEnabled={!!process.env.STRIPE_SECRET_KEY} />

      <p className="text-center text-sm text-slate-500">
        Not ready?{" "}
        <Link href="/dashboard" className="font-medium text-blue-400 hover:text-blue-400">
          Skip for now and explore the app
        </Link>
      </p>
    </div>
  );
}
