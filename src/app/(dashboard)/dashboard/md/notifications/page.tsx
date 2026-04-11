import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NotificationCenter } from "@/components/notifications/notification-center";

export default async function MdNotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as any;
  if (user.role !== "MD" && user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return <NotificationCenter />;
}
