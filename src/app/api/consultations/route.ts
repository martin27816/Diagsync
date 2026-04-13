import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addConsultationPatient, listConsultationQueue } from "@/lib/consultation-workflow";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createConsultationSchema = z.object({
  fullName: z.string().min(2, "Patient name is required"),
  age: z.number().int().min(0).max(130),
  contact: z.string().min(3, "Contact is required"),
  vitalsNote: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const date = searchParams.get("date") ?? undefined;
    const daysRaw = Number.parseInt(searchParams.get("days") ?? "14", 10);
    const days = Number.isNaN(daysRaw) ? 14 : daysRaw;

    const data = await listConsultationQueue({
      id: user.id,
      role: user.role,
      organizationId: user.organizationId,
    }, { search, date, days });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_ROLE") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    console.error("[CONSULTATIONS_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const parsed = createConsultationSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message ?? "Invalid payload" }, { status: 400 });
    }

    const user = session.user as any;
    const created = await addConsultationPatient(
      { id: user.id, role: user.role, organizationId: user.organizationId },
      parsed.data
    );
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_ROLE") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    console.error("[CONSULTATIONS_POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
