import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieName } from "@/lib/auth";

export function proxy(request: NextRequest) {
  if (!request.cookies.get(sessionCookieName)?.value) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/customers/:path*", "/opportunities/:path*"] };
