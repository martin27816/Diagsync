import { NextRequest, NextResponse } from "next/server";
import { OrganizationPlan } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BILLING_BANK_DETAILS, PLAN_MONTHLY_AMOUNT_NGN } from "@/lib/billing-access";
import { uploadToCloudinarySigned } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

function parseRequestedPlan(value: FormDataEntryValue | null): OrganizationPlan | null {
  if (typeof value !== "string") return null;
  if (value === "STARTER" || value === "ADVANCED") return value;
  return null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (!user.organizationId) {
    return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
  }

  const items = await prisma.subscriptionPaymentRequest.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      requestedPlan: true,
      amount: true,
      status: true,
      bankName: true,
      accountNumber: true,
      accountName: true,
      transactionReference: true,
      proofUrl: true,
      notes: true,
      reviewedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ success: true, data: items });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (!user.organizationId) {
    return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
  }

  try {
    const form = await req.formData();
    const requestedPlan = parseRequestedPlan(form.get("requestedPlan"));
    const transactionReference = String(form.get("transactionReference") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const proof = form.get("proof");

    if (!requestedPlan) {
      return NextResponse.json({ success: false, error: "Invalid plan selection." }, { status: 400 });
    }

    if (!transactionReference) {
      return NextResponse.json({ success: false, error: "Transaction reference is required." }, { status: 400 });
    }

    let proofUrl: string | null = null;
    if (proof instanceof File && proof.size > 0) {
      if (proof.size > 10 * 1024 * 1024) {
        return NextResponse.json({ success: false, error: "Proof upload is too large (max 10MB)." }, { status: 400 });
      }
      const buffer = Buffer.from(await proof.arrayBuffer());
      const uploadJson = await uploadToCloudinarySigned({
        fileType: proof.type || "application/octet-stream",
        buffer,
        folder: "diagsync/billing/proofs",
      });
      proofUrl = uploadJson.secure_url;
    }

    const amount = PLAN_MONTHLY_AMOUNT_NGN[requestedPlan];

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findUnique({
        where: { id: user.organizationId },
        select: {
          id: true,
          plan: true,
          status: true,
          subscriptionEndsAt: true,
        },
      });

      if (!organization) {
        throw new Error("ORGANIZATION_NOT_FOUND");
      }

      const pending = await tx.subscriptionPaymentRequest.findFirst({
        where: {
          organizationId: user.organizationId,
          status: "PENDING",
        },
        select: { id: true },
      });

      if (pending) {
        throw new Error("PENDING_REQUEST_EXISTS");
      }

      const request = await tx.subscriptionPaymentRequest.create({
        data: {
          organizationId: user.organizationId,
          requestedPlan,
          amount,
          status: "PENDING",
          bankName: BILLING_BANK_DETAILS.bankName,
          accountNumber: BILLING_BANK_DETAILS.accountNumber,
          accountName: BILLING_BANK_DETAILS.accountName,
          transactionReference,
          proofUrl,
          notes: notes || null,
        },
        select: {
          id: true,
          requestedPlan: true,
          amount: true,
          status: true,
          createdAt: true,
        },
      });

      const now = new Date();
      const hasActivePaidWindow =
        organization.status === "ACTIVE" &&
        organization.plan !== "TRIAL" &&
        organization.subscriptionEndsAt !== null &&
        organization.subscriptionEndsAt > now;

      await tx.organization.update({
        where: { id: user.organizationId },
        data: {
          ...(hasActivePaidWindow
            ? {
                status: "ACTIVE",
                billingLockedAt: null,
                billingLockReason: `Pending ${requestedPlan} ${requestedPlan === organization.plan ? "renewal" : "upgrade"} verification`,
              }
            : {
                status: "PAYMENT_PENDING",
                billingLockedAt: now,
                billingLockReason: `Awaiting payment verification for ${requestedPlan}`,
              }),
        },
      });

      return request;
    });

    return NextResponse.json({
      success: true,
      message: "Payment submitted. Your account will be activated after verification.",
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PENDING_REQUEST_EXISTS") {
      return NextResponse.json(
        { success: false, error: "You already have a pending payment request under review." },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "ORGANIZATION_NOT_FOUND") {
      return NextResponse.json({ success: false, error: "Organization not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "CLOUDINARY_SIGNED_ENV_MISSING") {
      return NextResponse.json(
        { success: false, error: "Payment proof storage is not configured." },
        { status: 500 }
      );
    }
    if (error instanceof Error && error.message.startsWith("CLOUDINARY_UPLOAD_FAILED:")) {
      return NextResponse.json(
        { success: false, error: error.message.replace("CLOUDINARY_UPLOAD_FAILED:", "") },
        { status: 502 }
      );
    }
    console.error("[BILLING_PAYMENT_REQUEST_POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
