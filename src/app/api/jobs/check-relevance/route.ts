import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/user";
import { checkJobRelevance } from "@/lib/groq";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    if (!user.groqApiKey) {
      return NextResponse.json({ error: "Please set your Groq API key in settings" }, { status: 400 });
    }
    if (!user.resumeText) {
      return NextResponse.json({ error: "Please upload your resume in settings" }, { status: 400 });
    }

    const { jobIds } = await req.json();

    if (!jobIds || !Array.isArray(jobIds)) {
      return NextResponse.json({ error: "jobIds array is required" }, { status: 400 });
    }

    const jobs = await prisma.job.findMany({
      where: { id: { in: jobIds }, userId: user.id },
    });

    const results = [];

    for (const job of jobs) {
      try {
        const result = await checkJobRelevance(
          user.groqApiKey,
          user.resumeText,
          job.title,
          job.description,
          job.company,
          user.experienceMonths
        );

        const updated = await prisma.job.update({
          where: { id: job.id },
          data: {
            relevanceScore: result.score,
            relevanceReason: result.reason,
            isRelevant: result.isRelevant,
          },
        });

        results.push(updated);
      } catch (error) {
        console.error(`Relevance check failed for job ${job.id}:`, error);
        results.push({ ...job, error: "Failed to check relevance" });
      }
    }

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
