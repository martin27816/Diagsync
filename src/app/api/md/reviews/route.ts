import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMdReviewItems } from "@/lib/md-workflow";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;
    if (user.role !== "MD") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") ?? "pending") as
      | "all"
      | "pending"
      | "approved"
      | "rejected";

    const data = await getMdReviewItems(
      { id: user.id, role: user.role, organizationId: user.organizationId },
      status
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_ROLE") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    console.error("[MD_REVIEWS_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

