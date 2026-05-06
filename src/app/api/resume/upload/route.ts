import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/user";
import { extractTextFromPDF } from "@/lib/pdf-parse";
import { uploadResumePDF } from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const formData = await req.formData();
    const file = formData.get("resume") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const [resumeText, resumeUrl] = await Promise.all([
      extractTextFromPDF(buffer),
      uploadResumePDF(buffer, file.name, user.id),
    ]);

    if (!resumeText.trim()) {
      return NextResponse.json({ error: "Could not extract text from PDF" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resumeText: resumeText.trim(),
        resumeFileName: file.name,
        resumeUrl,
      },
    });

    return NextResponse.json({
      success: true,
      fileName: file.name,
      resumeUrl,
      textLength: resumeText.length,
      preview: resumeText.slice(0, 500),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Resume upload error:", error);
    return NextResponse.json({ error: "Failed to upload resume" }, { status: 500 });
  }
}
