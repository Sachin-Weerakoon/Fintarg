import { NextResponse, type NextRequest } from "next/server";

/**
 * Issues the CSRF cookie.
 *
 * A Server Component cannot write cookies (Next.js forbids it outside Server
 * Actions and Route Handlers), so the readable double-submit token is minted
 * here, on the way in. Pages then only ever *read* it.
 */
const CSRF_COOKIE = "fintarg_csrf";

export function middleware(request: NextRequest) {
  if (request.cookies.get(CSRF_COOKIE)?.value) {
    return NextResponse.next();
  }

  const token = crypto.randomUUID();

  // Copy the cookie onto the request so the page render sees it immediately,
  // and onto the response so the browser stores it for the next request.
  request.cookies.set(CSRF_COOKIE, token);

  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimisation output.
    "/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2)$).*)",
  ],
};