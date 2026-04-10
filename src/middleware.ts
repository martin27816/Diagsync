import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getDashboardPath } from "@/lib/utils";
import { Role } from "@prisma/client";

// Routes that don't need authentication
const publicRoutes = ["/login", "/register", "/api/auth"];

// Which roles can access which dashboard paths
const roleRouteMap: Record<string, Role[]> = {
  "/dashboard/receptionist": ["RECEPTIONIST", "SUPER_ADMIN"],
  "/dashboard/lab-scientist": ["LAB_SCIENTIST", "SUPER_ADMIN"],
  "/dashboard/radiographer": ["RADIOGRAPHER", "SUPER_ADMIN"],
  "/dashboard/md": ["MD", "SUPER_ADMIN"],
  "/dashboard/hrm": ["HRM", "SUPER_ADMIN"],
};

export default auth((req) => {
  const { nextUrl, auth: session } = req as any;
  const pathname = nextUrl.pathname;

  // Allow public routes through
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );
  if (isPublicRoute) {
    // If already logged in, redirect away from login/register
    if (session?.user && (pathname === "/login" || pathname === "/register")) {
      const role = session.user.role as Role;
      return NextResponse.redirect(
        new URL(getDashboardPath(role), nextUrl.origin)
      );
    }
    return NextResponse.next();
  }

  // Not logged in — redirect to login
  if (!session?.user) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = session.user.role as Role;

  // Root path — redirect to role dashboard
  if (pathname === "/" || pathname === "/dashboard") {
    return NextResponse.redirect(
      new URL(getDashboardPath(userRole), nextUrl.origin)
    );
  }

  // Check dashboard route permissions
  for (const [route, allowedRoles] of Object.entries(roleRouteMap)) {
    if (pathname.startsWith(route)) {
      if (!allowedRoles.includes(userRole)) {
        // Redirect to their own dashboard instead
        return NextResponse.redirect(
          new URL(getDashboardPath(userRole), nextUrl.origin)
        );
      }
      break;
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
