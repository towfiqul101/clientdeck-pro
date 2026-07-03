import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Agency auth pages — always reachable while signed out.
const AUTH_ROUTES = ["/login", "/signup"];

// Public marketing/legal pages — reachable while signed out.
const PUBLIC_ROUTES = ["/", "/snapshot", "/terms", "/privacy"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. API routes handle their own auth (webhooks, service role, portal).
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // 2. Portal (client-facing) — separate auth via the portal_session cookie.
  //    Never apply staff Supabase Auth here.
  if (pathname.startsWith("/portal")) {
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
