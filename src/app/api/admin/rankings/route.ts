import { NextRequest, NextResponse } from "next/server";
import { requireMegaAdminApi } from "@/lib/admin-auth";
import { getAllRankings, type RankingPeriod } from "@/lib/ranking/get-all-rankings";

export const dynamic = "force-dynamic";

function parsePeriod(value: string | null): RankingPeriod {
  return value === "monthly" ? "monthly" : "weekly";
}

export async function GET(req: NextRequest) {
  const guard = await requireMegaAdminApi();
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }

  try {
    const period = parsePeriod(new URL(req.url).searchParams.get("period"));
    const data = await getAllRankings(period);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[ADMIN_RANKINGS_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
