import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addImagingFile } from "@/lib/radiology-workflow";
import { isValidImagingFile } from "@/lib/radiology-workflow-core";
import { uploadToCloudinarySigned } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    if (!isValidImagingFile({ mimeType: file.type, sizeBytes: file.size })) {
      return NextResponse.json(
        { success: false, error: "Invalid file type or size (max 25MB)" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadJson = await uploadToCloudinarySigned({
      fileType: file.type,
      buffer,
      folder: "diagsync/radiology",
    });

    const saved = await addImagingFile(
      params.taskId,
      { id: user.id, role: user.role, organizationId: user.organizationId },
      {
        fileUrl: uploadJson.secure_url,
        fileType: file.type,
        fileName: file.name,
        fileSizeBytes: file.size,
        metadata: {
          width: uploadJson.width ?? null,
          height: uploadJson.height ?? null,
          format: uploadJson.format ?? null,
          resourceType: uploadJson.resource_type ?? null,
          publicId: uploadJson.public_id ?? null,
        },
      }
    );

    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_ROLE" || error.message === "FORBIDDEN_TASK") {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "FEATURE_NOT_AVAILABLE") {
        return NextResponse.json({ success: false, error: "Imaging uploads are available on Trial or Advanced plan." }, { status: 403 });
      }
      if (error.message === "BILLING_LOCKED") {
        return NextResponse.json({ success: false, error: "Billing access required. Please choose or renew a plan." }, { status: 403 });
      }
      if (error.message === "TASK_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      if (error.message === "INVALID_FILE") {
        return NextResponse.json({ success: false, error: "Invalid file type or size" }, { status: 400 });
      }
      if (error.message === "CLOUDINARY_SIGNED_ENV_MISSING") {
        return NextResponse.json(
          { success: false, error: "Imaging storage is not configured (Cloudinary signed env missing)" },
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

    console.error("[RAD_TASK_UPLOAD]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
