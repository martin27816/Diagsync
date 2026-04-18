import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export function isMegaAdmin(role: string | null | undefined): boolean {
  return role === "MEGA_ADMIN";
}

export async function requireMegaAdmin() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/dashboard");
  }

  const user = session.user as {
    id: string;
    email: string;
    fullName: string;
    role: string;
    organizationId: string | null;
  };

  if (!isMegaAdmin(user.role)) {
    redirect("/dashboard");
  }

  return user;
}

export async function requireMegaAdminApi() {
  const session = await auth();
  if (!session?.user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const user = session.user as {
    id: string;
    email: string;
    fullName: string;
    role: string;
    organizationId: string | null;
  };

  if (!isMegaAdmin(user.role)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, user };
}
