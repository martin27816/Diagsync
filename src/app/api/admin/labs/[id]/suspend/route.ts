import { NextResponse } from "next/server";
import { requireMegaAdminApi } from "@/lib/admin-auth";
import { setOrganizationStatus } from "@/lib/admin-data";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireMegaAdminApi();
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }

  try {
    const updated = await setOrganizationStatus(params.id, "SUSPENDED");
    await prisma.organization.update({
      where: { id: params.id },
      data: {
        billingLockedAt: new Date(),
        billingLockReason: "Suspended by platform admin",
      },
    });
    return NextResponse.json({ success: true, data: updated, message: "Lab suspended" });
  } catch {
    return NextResponse.json({ success: false, error: "Lab not found" }, { status: 404 });
  }
}
