import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDashboardPath } from "@/lib/utils";
import { Role } from "@prisma/client";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    const role = (session.user as any).role as Role;
    redirect(getDashboardPath(role));
  }
  redirect("/login");
}
