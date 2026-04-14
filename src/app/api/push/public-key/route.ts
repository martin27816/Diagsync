import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPushPublicKey } from "@/lib/push-notifications";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const publicKey = getPushPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { success: false, error: "Push is not configured on server" },
      { status: 503 }
    );
  }

  return NextResponse.json({ success: true, data: { publicKey } });
}
