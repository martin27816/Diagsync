import { NextRequest, NextResponse } from "next/server";
import { requireMegaAdminApi } from "@/lib/admin-auth";
import { listPlatformUsers } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireMegaAdminApi();
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "20");
  const search = searchParams.get("search") ?? undefined;
  const role = searchParams.get("role") ?? undefined;
  const organizationId = searchParams.get("organizationId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const data = await listPlatformUsers({
    page,
    pageSize,
    search,
    role,
    organizationId,
    status,
  });

  return NextResponse.json({ success: true, data });
}
