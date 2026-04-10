import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/tests/[id] — get a single test with its result template fields
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;

    const test = await prisma.diagnosticTest.findFirst({
      where: {
        id: params.id,
        organizationId: user.organizationId,
        isActive: true,
      },
      include: {
        category: true,
        resultFields: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!test) {
      return NextResponse.json(
        { success: false, error: "Test not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: test });
  } catch (error) {
    console.error("[TEST_GET_ID]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}