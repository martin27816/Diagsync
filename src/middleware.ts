import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDashboardPath } from "@/lib/utils";
import { Role } from "@prisma/client";

const publicRoutes = ["/", "/login", "/register", "/api/auth"];

const roleRouteMap: Record<string, Role[]> = {
  "/dashboard/receptionist": ["RECEPTIONIST", "SUPER_ADMIN"],
  "/dashboard/lab-scientist": ["LAB_SCIENTIST", "SUPER_ADMIN"],
  "/dashboard/radiographer": ["RADIOGRAPHER", "SUPER_ADMIN"],
  "/dashboard/md": ["MD", "SUPER_ADMIN"],
  "/dashboard/hrm": ["HRM", "SUPER_ADMIN"],
};

export default async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  if (isPublicRoute) {
    if (token && (pathname === "/login" || pathname === "/register")) {
      const role = token.role as Role;
      return NextResponse.redirect(new URL(getDashboardPath(role), nextUrl.origin));
    }
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = token.role as Role;

  if (pathname === "/" || pathname === "/dashboard") {
    return NextResponse.redirect(new URL(getDashboardPath(userRole), nextUrl.origin));
  }

  for (const [route, allowedRoles] of Object.entries(roleRouteMap)) {
    if (pathname.startsWith(route) && !allowedRoles.includes(userRole)) {
      return NextResponse.redirect(new URL(getDashboardPath(userRole), nextUrl.origin));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};

