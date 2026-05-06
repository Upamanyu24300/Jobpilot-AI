import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/user";
import {
  analyzeResume,
  checkJobRelevance,
  tailorResume,
  generateCoverLetter,
  parseResumeToStructure,
  createGroqClient,
  type RelevanceAnalysis,
} from "@/lib/groq";
import { scrapeLinkedInJobs, type LinkedInJob } from "@/lib/linkedin";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { action } = body;

    if (!user.groqApiKey) {
      return NextResponse.json({ error: "Please set your Groq API key in Settings first." }, { status: 400 });
    }

    // ── analyze ──────────────────────────────────────────────────────────────
    if (action === "analyze") {
      if (!user.resumeText) {
        return NextResponse.json({ error: "Please upload your resume in Settings first." }, { status: 400 });
      }
      const analysis = await analyzeResume(user.groqApiKey, user.resumeText);
      return NextResponse.json({ analysis });
    }

    // ── search ───────────────────────────────────────────────────────────────
    if (action === "search") {
      if (!user.apifyToken) {
        return NextResponse.json({ error: "Please set your Apify token in Settings first." }, { status: 400 });
      }
      const { searchQuery } = body as { searchQuery: string };
      const results = await scrapeLinkedInJobs(user.apifyToken, searchQuery, "");
      if (!results.length) {
        return NextResponse.json({ error: "No jobs found for this search. Try a broader query." }, { status: 404 });
      }
      const job = results[0];
      return NextResponse.json({ job });
    }

    // ── match ────────────────────────────────────────────────────────────────
    if (action === "match") {
      if (!user.resumeText) {
        return NextResponse.json({ error: "Please upload your resume in Settings first." }, { status: 400 });
      }
      const { job } = body as { job: LinkedInJob };
      const result = await checkJobRelevance(
        user.groqApiKey,
        user.resumeText,
        job.title,
        job.description,
        job.company,
        user.experienceMonths
      );
      const analysis: RelevanceAnalysis = JSON.parse(result.reason);
      return NextResponse.json({ score: result.score, isRelevant: result.isRelevant, analysis });
    }

    // ── tailor ───────────────────────────────────────────────────────────────
    if (action === "tailor") {
      if (!user.resumeText) {
        return NextResponse.json({ error: "Please upload your resume in Settings first." }, { status: 400 });
      }
      const { job } = body as { job: LinkedInJob };

      const groq = createGroqClient(user.groqApiKey);
      const [tailoredStr, coverLetter, original] = await Promise.all([
        tailorResume(user.groqApiKey, user.resumeText, job.title, job.description, job.company),
        generateCoverLetter(user.groqApiKey, user.resumeText, job.title, job.description, job.company),
        parseResumeToStructure(groq, user.resumeText),
      ]);

      // tailoredStr is JSON (StructuredResume) or markdown fallback
      let tailored = null;
      try { tailored = JSON.parse(tailoredStr); } catch { /* markdown fallback */ }

      return NextResponse.json({ tailored, original, tailoredRaw: tailoredStr, coverLetter });
    }

    // ── apply ────────────────────────────────────────────────────────────────
    if (action === "apply") {
      const { job, tailoredRaw, coverLetter } = body as {
        job: LinkedInJob;
        tailoredRaw: string;
        coverLetter: string;
      };

      // Upsert the job row first
      const existingJob = await prisma.job.findFirst({
        where: { url: job.url, userId: user.id },
      });

      const jobRow = existingJob ?? await prisma.job.create({
        data: {
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description,
          url: job.url,
          salary: job.salary || "",
          jobType: job.jobType || "",
          postedAt: job.postedAt || "",
          source: "linkedin",
          userId: user.id,
        },
      });

      const application = await prisma.application.upsert({
        where: { jobId: jobRow.id },
        update: { tailoredResume: tailoredRaw, coverLetter, status: "pending" },
        create: {
          jobId: jobRow.id,
          userId: user.id,
          tailoredResume: tailoredRaw,
          coverLetter,
          status: "pending",
        },
      });

      return NextResponse.json({ applicationId: application.id });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[sample-apply]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Something went wrong" },
      { status: 500 }
    );
  }
}
