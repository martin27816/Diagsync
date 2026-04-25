import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPushPublicKey } from "@/lib/push-notifications";
import { requireOrganizationFeature } from "@/lib/billing-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;
    await requireOrganizationFeature(user.organizationId, "web_push");

    const publicKey = getPushPublicKey();
    if (!publicKey) {
      return NextResponse.json(
        { success: false, error: "Push is not configured on server" },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, data: { publicKey } });
  } catch (error) {
    if (error instanceof Error && error.message === "BILLING_LOCKED") {
      return NextResponse.json(
        { success: false, error: "Billing access required. Please choose or renew a plan." },
        { status: 403 }
      );
    }
    if (error instanceof Error && error.message === "FEATURE_NOT_AVAILABLE") {
      return NextResponse.json(
        { success: false, error: "Web push notifications are available on Trial or Advanced plan." },
        { status: 403 }
      );
    }
    console.error("[PUSH_PUBLIC_KEY_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
