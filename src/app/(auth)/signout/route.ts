import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Clears the Supabase session and returns to /login. Used as the safe fallback
 * when a user is authenticated but has no usable agency/team_member record —
 * redirecting straight to /login would bounce back off middleware and loop.
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
