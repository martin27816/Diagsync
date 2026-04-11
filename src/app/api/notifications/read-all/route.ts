import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markAllNotificationsAsRead } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function PATCH() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const count = await markAllNotificationsAsRead({
      id: user.id,
      role: user.role,
      organizationId: user.organizationId,
    });

    return NextResponse.json({ success: true, data: { count } });
  } catch (error) {
    console.error("[NOTIFICATIONS_READ_ALL]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
