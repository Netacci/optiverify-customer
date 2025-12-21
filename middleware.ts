import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("cd-token");
  const { pathname } = request.nextUrl;

  // Protect dashboard, requests, and settings routes
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/requests") || pathname.startsWith("/settings")) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect logged-in users away from login/create-password/verify/forgot-password/reset-password if they have a token
  if (
    (pathname === "/login" ||
      pathname === "/create-password" ||
      pathname === "/verify" ||
      pathname === "/forgot-password" ||
      pathname === "/reset-password") &&
    token
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/requests/:path*", "/settings/:path*", "/login", "/create-password", "/verify", "/forgot-password", "/reset-password"],
};

