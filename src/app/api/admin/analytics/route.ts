import { NextResponse } from "next/server";
import { requireMegaAdminApi } from "@/lib/admin-auth";
import { getAdminAnalytics } from "@/lib/admin-analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireMegaAdminApi();
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }

  const data = await getAdminAnalytics();
  return NextResponse.json({ success: true, data });
}
