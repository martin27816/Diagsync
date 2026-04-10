import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/visits/[visitId]
export async function GET(
  req: NextRequest,
  { params }: { params: { visitId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;

    const visit = await prisma.visit.findFirst({
      where: { id: params.visitId, organizationId: user.organizationId },
      include: {
        patient: true,
        testOrders: {
          include: {
            test: {
              include: {
                category: { select: { name: true } },
                resultFields: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
          orderBy: { registeredAt: "asc" },
        },
      },
    });

    if (!visit) {
      return NextResponse.json({ success: false, error: "Visit not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: visit });
  } catch (error) {
    console.error("[VISIT_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
