import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Role, Sex, Priority, PaymentStatus } from "@prisma/client";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { assignTasksForVisit } from "@/lib/routing-engine";

export const dynamic = "force-dynamic";

const registerPatientSchema = z.object({
  // Patient details
  fullName: z.string().min(2, "Full name required"),
  age: z.number().int().min(0).max(150),
  sex: z.nativeEnum(Sex),
  phone: z.string().min(7, "Phone number required"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  referringDoctor: z.string().optional(),
  clinicalNote: z.string().optional(),

  // Visit details
  priority: z.nativeEnum(Priority).default(Priority.ROUTINE),
  paymentStatus: z.nativeEnum(PaymentStatus).default(PaymentStatus.PENDING),
  amountPaid: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),

  // Test orders
  testIds: z.array(z.string()).min(1, "At least one test is required"),
  testPrices: z
    .array(
      z.object({
        testId: z.string().min(1),
        price: z.number().min(0, "Price cannot be negative"),
      })
    )
    .min(1, "Provide prices for selected tests"),
});

// GET /api/patients — list patients for org
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20");
    const today = searchParams.get("today") === "true";

    const where: any = {
      organizationId: user.organizationId,
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { patientId: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(today && {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      }),
    };

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        include: {
          visits: {
            orderBy: { registeredAt: "desc" },
            take: 1,
            include: {
              testOrders: {
                include: { test: { select: { name: true, type: true, department: true } } },
              },
            },
          },
          registeredBy: { select: { fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.patient.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: patients,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("[PATIENTS_GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/patients — register new patient + visit + test orders
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;

    if (!["RECEPTIONIST", "SUPER_ADMIN", "HRM"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = registerPatientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Fetch tests to get prices
    const tests = await prisma.diagnosticTest.findMany({
      where: {
        id: { in: data.testIds },
        organizationId: user.organizationId,
        isActive: true,
      },
    });

    if (tests.length !== data.testIds.length) {
      return NextResponse.json(
        { success: false, error: "One or more tests not found or inactive" },
        { status: 400 }
      );
    }

    const submittedPrices = new Map(data.testPrices.map((item) => [item.testId, item.price]));
    const uniquePriceKeys = new Set(data.testPrices.map((item) => item.testId));
    if (uniquePriceKeys.size !== data.testPrices.length) {
      return NextResponse.json(
        { success: false, error: "Duplicate test prices submitted" },
        { status: 400 }
      );
    }
    if (submittedPrices.size !== data.testIds.length || data.testIds.some((testId) => !submittedPrices.has(testId))) {
      return NextResponse.json(
        { success: false, error: "Please provide a price for each selected test" },
        { status: 400 }
      );
    }

    // Calculate totals from receptionist-entered prices
    const subtotal = data.testIds.reduce((sum, testId) => sum + (submittedPrices.get(testId) ?? 0), 0);
    const totalAmount = Math.max(0, subtotal - data.discount);

    const result = await prisma.$transaction(async (tx) => {
      // Count existing patients for ID generation
      const orgAbbr = user.organizationId.slice(0, 3).toUpperCase();
      const patientCount = await tx.patient.count({
        where: { organizationId: user.organizationId },
      });

      const patientId = `PT-${orgAbbr}-${String(patientCount + 1).padStart(5, "0")}`;

      // Create patient
      const patient = await tx.patient.create({
        data: {
          organizationId: user.organizationId,
          patientId,
          fullName: data.fullName,
          age: data.age,
          sex: data.sex,
          phone: data.phone,
          email: data.email || null,
          address: data.address || null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          referringDoctor: data.referringDoctor || null,
          clinicalNote: data.clinicalNote || null,
          registeredById: user.id,
        },
      });

      // Create visit
      const visitCount = await tx.visit.count({
        where: { organizationId: user.organizationId },
      });
      const visitNumber = `V-${orgAbbr}-${String(visitCount + 1).padStart(5, "0")}`;

      const visit = await tx.visit.create({
        data: {
          patientId: patient.id,
          organizationId: user.organizationId,
          visitNumber,
          priority: data.priority,
          paymentStatus: data.paymentStatus,
          totalAmount,
          amountPaid: data.amountPaid,
          discount: data.discount,
          paymentMethod: data.paymentMethod || null,
          notes: data.notes || null,
        },
      });

      // Create test orders
      const testOrders = await Promise.all(
        tests.map((test) =>
          tx.testOrder.create({
            data: {
              visitId: visit.id,
              testId: test.id,
              organizationId: user.organizationId,
              status: "REGISTERED",
              price: submittedPrices.get(test.id) ?? 0,
            },
          })
        )
      );

      return { patient, visit, testOrders };
    });

    let routing: Awaited<ReturnType<typeof assignTasksForVisit>> = [];
    let routingWarning: string | null = null;
    try {
      routing = await assignTasksForVisit(result.visit.id, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role as Role,
      });
    } catch (routingError) {
      console.error("[PATIENTS_POST_ROUTE]", routingError);
      routingWarning = "Patient was registered, but auto-routing failed. You can route this visit manually.";
    }

    // Audit log
    await createAuditLog({
      actorId: user.id,
      actorRole: user.role as Role,
      action: AUDIT_ACTIONS.PATIENT_REGISTERED ?? "PATIENT_REGISTERED",
      entityType: "Patient",
      entityId: result.patient.id,
      newValue: {
        patientId: result.patient.patientId,
        fullName: result.patient.fullName,
        visitNumber: result.visit.visitNumber,
        tests: tests.map((t) => t.name),
        totalAmount,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Patient registered successfully",
        data: {
          patientId: result.patient.patientId,
          patientDbId: result.patient.id,
          visitId: result.visit.id,
          visitNumber: result.visit.visitNumber,
          testOrderIds: result.testOrders.map((o) => o.id),
          totalAmount,
          routing,
          routingWarning,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[PATIENTS_POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
