import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

// Agency auth pages — always reachable while signed out.
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

// Public marketing/legal pages — reachable while signed out.
// /reset-password lives here (not AUTH_ROUTES): a Supabase password-recovery
// session is itself a valid signed-in session, so putting it in AUTH_ROUTES
// would trigger the "signed-in user hitting an auth route -> /dashboard" rule
// below and bounce the user away before they can set their password.
const PUBLIC_ROUTES = [
  "/",
  "/snapshot",
  "/terms",
  "/privacy",
  "/reset-password",
  // OAuth code exchange — runs while the Supabase session doesn't exist yet.
  "/auth/callback",
  // MFA challenge — reachable at AAL1 (signed in, second factor pending), so
  // it can be neither an AUTH_ROUTE (signed-in bounce) nor protected.
  "/auth/mfa",
  "/site.webmanifest",
  "/sw.js",
];

/** True for the app's own hosts (production domain, Vercel preview/prod
 *  aliases, localhost) — i.e. NOT a candidate for custom-domain resolution. */
function isPrimaryAppHost(host: string): boolean {
  const bare = host.split(":")[0].toLowerCase();
  if (bare === "localhost" || bare === "127.0.0.1") return true;
  if (bare.endsWith(".vercel.app")) return true;
  try {
    const appHost = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "").hostname.toLowerCase();
    return bare === appHost;
  } catch {
    // NEXT_PUBLIC_APP_URL is unset/malformed — an operational misconfig
    // unrelated to any agency's custom-domain setup. Don't let that turn
    // into "reject all portal traffic": treat the host as indeterminate and
    // let it through, same as the "Supabase isn't configured" fallback
    // below. The token/cookie flow remains the real security boundary.
    return true;
  }
}

/** True if `host` is a verified custom_domain on some agency. */
async function isVerifiedAgencyDomain(host: string): Promise<boolean> {
  const bare = host.split(":")[0].toLowerCase();
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("agencies")
      .select("id")
      .eq("custom_domain", bare)
      .eq("custom_domain_verified", true)
      .maybeSingle();
    return Boolean(data);
  } catch {
    // This only runs for non-primary-host /portal traffic (an actual or
    // spoofed custom-domain request) — ordinary agency/localhost traffic
    // never reaches here. Fail closed: a DB/env failure should reject as
    // "not verified", not crash the middleware with a 500.
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. White-label hosts: an agency's VERIFIED custom domain serves ONLY the
  //    client-portal surface. Vercel attaches the domain to the whole project,
  //    so without this, portal.agency.com/ served the RoundTrack marketing
  //    site and /login the staff app — a branding leak on a domain the
  //    agency's clients see. Anything that isn't the portal (or the API and
  //    PWA assets the portal itself needs) redirects to /portal. Hosts that
  //    are NOT a verified custom domain keep the normal routing below — that
  //    deliberately includes unknown foreign hosts, so a misconfigured
  //    NEXT_PUBLIC_APP_URL can never 404 the primary site itself.
  const host = request.headers.get("host");
  const isWhiteLabelHost =
    host && !isPrimaryAppHost(host) ? await isVerifiedAgencyDomain(host) : false;
  if (
    isWhiteLabelHost &&
    !pathname.startsWith("/portal") &&
    !pathname.startsWith("/api") &&
    pathname !== "/sw.js" &&
    pathname !== "/site.webmanifest"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/portal";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 1. API routes handle their own auth (webhooks, service role, portal).
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // 2. Portal (client-facing) — separate auth via the portal_session cookie.
  //    Never apply staff Supabase Auth here.
  if (pathname.startsWith("/portal")) {
    // Defense-in-depth: on any Host that isn't our own, only proceed if it's
    // a verified custom domain (already resolved in step 0). The token/cookie
    // flow below is fully host-agnostic and does the real work; this just
    // guards against stale DNS after an agency disconnects their domain.
    if (host && !isPrimaryAppHost(host) && !isWhiteLabelHost) {
      return new NextResponse("Not found", { status: 404 });
    }
    if (pathname === "/portal") {
      // Magic-link entry: exchange ?token= for an httpOnly session cookie.
      const token = request.nextUrl.searchParams.get("token");
      if (token) {
        const url = request.nextUrl.clone();
        url.pathname = "/portal/dashboard";
        url.search = "";
        const res = NextResponse.redirect(url);
        res.cookies.set("portal_session", token, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 30 * 24 * 60 * 60,
        });
        return res;
      }
      // No token → entry page renders (handles ?expired / invalid states).
      return NextResponse.next();
    }
    // Protected portal subroutes require the session cookie (layout re-validates).
    if (!request.cookies.get("portal_session")) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal";
      url.search = "?expired=true";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 2a. Admin panel — completely separate auth. It self-guards via the
  //     rtp_admin_session cookie (see @/lib/admin/session) and has NO dependency
  //     on Supabase Auth, so let every /admin route (including /admin/login)
  //     through untouched.
  if (pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // 2b. If Supabase isn't configured yet (e.g. env vars not set on a fresh
  //     deploy), don't crash every route with MIDDLEWARE_INVOCATION_FAILED.
  //     Let requests through — pages self-protect via getSessionContext().
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next({ request });
  }

  // 3. Everything else is the agency app. Refresh the Supabase session.
  //    `response` accumulates any refreshed auth cookies; those MUST be copied
  //    onto any redirect we return, or the browser never updates and loops.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // Signed-out user hitting a protected route → login (carry refreshed cookies).
  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return redirectWithCookies(url, response);
  }

  // Signed-in user hitting /login or /signup → dashboard.
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}

/**
 * Redirects while preserving any auth cookies Supabase refreshed onto `from`.
 * Without this, a token refresh during getUser() is silently dropped and the
 * browser retries with the stale cookie forever (ERR_TOO_MANY_REDIRECTS).
 */
function redirectWithCookies(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
