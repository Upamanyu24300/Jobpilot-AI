import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/user";
import { renderResumePDF } from "@/lib/resume-pdf";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { applicationId } = await req.json();

    const application = await prisma.application.findFirst({
      where: { id: applicationId, userId: user.id },
      include: { job: true },
    });

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const pdfBuffer = await renderResumePDF(application.tailoredResume);
    const filename = `${user.name || "resume"}-${application.job.company}.pdf`
      .toLowerCase()
      .replace(/\s+/g, "-");

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
