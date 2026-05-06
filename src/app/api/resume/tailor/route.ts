import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/user";
import { tailorResume, generateCoverLetter } from "@/lib/groq";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    if (!user.groqApiKey) {
      return NextResponse.json({ error: "Please set your Groq API key in settings" }, { status: 400 });
    }
    if (!user.resumeText) {
      return NextResponse.json({ error: "Please upload your resume in settings" }, { status: 400 });
    }

    const { jobId } = await req.json();

    const job = await prisma.job.findFirst({
      where: { id: jobId, userId: user.id },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const [tailoredResume, coverLetter] = await Promise.all([
      tailorResume(user.groqApiKey, user.resumeText, job.title, job.description, job.company),
      generateCoverLetter(user.groqApiKey, user.resumeText, job.title, job.description, job.company),
    ]);

    const application = await prisma.application.upsert({
      where: { jobId: job.id },
      update: { tailoredResume, coverLetter },
      create: {
        jobId: job.id,
        userId: user.id,
        tailoredResume,
        coverLetter,
        status: "pending",
      },
    });

    return NextResponse.json({ application, tailoredResume, coverLetter });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Resume tailor error:", error);
    return NextResponse.json({ error: "Failed to tailor resume" }, { status: 500 });
  }
}
