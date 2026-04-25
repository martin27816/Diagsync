import { NextRequest, NextResponse } from "next/server";
import { uploadToCloudinarySigned } from "@/lib/cloudinary";
import { auth } from "@/lib/auth";
import { requireOrganizationFeature } from "@/lib/billing-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user) {
      const user = session.user as any;
      await requireOrganizationFeature(user.organizationId, "custom_letterhead");
    }

    const form = await req.formData();
    const file = form.get("file");
    const folder = (form.get("folder") as string) || "diagsync/branding";

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadJson = await uploadToCloudinarySigned({
      fileType: file.type,
      buffer,
      folder,
    });

    return NextResponse.json({
      success: true,
      data: {
        fileUrl: uploadJson.secure_url,
        publicId: uploadJson.public_id ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "BILLING_LOCKED") {
        return NextResponse.json(
          { success: false, error: "Billing access required. Please choose or renew a plan." },
          { status: 403 }
        );
      }
      if (error.message === "FEATURE_NOT_AVAILABLE") {
        return NextResponse.json(
          { success: false, error: "Custom branding uploads are available on Trial or Advanced plan." },
          { status: 403 }
        );
      }
      if (error.message === "CLOUDINARY_SIGNED_ENV_MISSING") {
        return NextResponse.json(
          { success: false, error: "Branding storage is not configured (Cloudinary signed env missing)" },
          { status: 500 }
        );
      }
      if (error.message.startsWith("CLOUDINARY_UPLOAD_FAILED:")) {
        return NextResponse.json(
          { success: false, error: error.message.replace("CLOUDINARY_UPLOAD_FAILED:", "") },
          { status: 502 }
        );
      }
    }
    console.error("[BRANDING_UPLOAD]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
