import type { Metadata } from "next";
import { ShieldCheck, AlertCircle } from "lucide-react";
import { adminLoginAction } from "./actions";

export const metadata: Metadata = {
  title: "Admin Access — ClientDeck Pro",
  robots: { index: false, follow: false },
};

// Never cache — this page reflects auth state and env config.
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 text-white">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-xl font-semibold text-gray-900">
              Admin Access
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              ClientDeck Pro Admin Panel
            </p>
          </div>

          {error && (
            <div className="mt-6 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Invalid password. Please try again.</span>
            </div>
          )}

          <form action={adminLoginAction} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Admin Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                placeholder="••••••••••••••••"
                className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Sign In
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Super-admin access only. This area is separate from agency accounts.
        </p>
      </div>
    </main>
  );
}
