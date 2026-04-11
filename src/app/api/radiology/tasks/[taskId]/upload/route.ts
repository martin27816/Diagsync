import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addImagingFile } from "@/lib/radiology-workflow";
import { isValidImagingFile } from "@/lib/radiology-workflow-core";

export const dynamic = "force-dynamic";

function toDataUri(fileType: string, base64: string) {
  return `data:${fileType};base64,${base64}`;
}

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

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      return NextResponse.json(
        { success: false, error: "Imaging storage is not configured (Cloudinary env missing)" },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const uploadBody = new URLSearchParams();
    uploadBody.set("file", toDataUri(file.type, base64));
    uploadBody.set("upload_preset", uploadPreset);
    uploadBody.set("folder", "diagsync/radiology");

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      {
        method: "POST",
        body: uploadBody,
      }
    );

    const uploadJson = await uploadRes.json();
    if (!uploadRes.ok || !uploadJson?.secure_url) {
      return NextResponse.json(
        { success: false, error: "External upload failed. Please retry." },
        { status: 502 }
      );
    }

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
      if (error.message === "TASK_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
      }
      if (error.message === "INVALID_FILE") {
        return NextResponse.json({ success: false, error: "Invalid file type or size" }, { status: 400 });
      }
    }

    console.error("[RAD_TASK_UPLOAD]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

