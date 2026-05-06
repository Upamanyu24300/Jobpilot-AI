import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/user";
import { scrapeLinkedInJobs } from "@/lib/linkedin";
import { checkJobRelevance, tailorResume, generateCoverLetter } from "@/lib/groq";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    if (!user.groqApiKey) {
      return NextResponse.json({ error: "Please set your Groq API key in settings" }, { status: 400 });
    }
    if (!user.apifyToken) {
      return NextResponse.json({ error: "Please set your Apify token in settings" }, { status: 400 });
    }
    if (!user.resumeText) {
      return NextResponse.json({ error: "Please upload your resume in settings" }, { status: 400 });
    }

    const { query, location, maxRelevantJobs = -1 } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    const log: string[] = [];
    const push = (msg: string) => {
      log.push(msg);
      console.log(`[Pipeline] ${msg}`);
    };

    // Step 1: Scrape
    push("Searching LinkedIn via Apify...");
    const scrapedJobs = await scrapeLinkedInJobs(user.apifyToken, query, location || "");
    push(`Found ${scrapedJobs.length} job listings`);

    if (scrapedJobs.length === 0) {
      return NextResponse.json({
        success: true, log,
        stats: { scraped: 0, saved: 0, relevant: 0, tailored: 0 },
      });
    }

    // Step 2: Save jobs (descriptions already included from Apify)
    push("Saving jobs to database...");
    const savedJobs = [];
    for (const job of scrapedJobs.slice(0, 25)) {
      const existing = await prisma.job.findFirst({
        where: { url: job.url, userId: user.id },
      });
      if (existing) { savedJobs.push(existing); continue; }

      const saved = await prisma.job.create({
        data: {
          title: job.title, company: job.company, location: job.location,
          description: job.description, url: job.url, salary: job.salary,
          jobType: job.jobType, postedAt: job.postedAt,
          source: "linkedin", userId: user.id,
        },
      });
      savedJobs.push(saved);
    }
    push(`Saved ${savedJobs.length} jobs`);

    // Step 3: Check relevance
    push("Checking relevance with AI...");
    const relevantJobs = [];
    for (const job of savedJobs) {
      if (!job.description) continue;
      const result = await checkJobRelevance(
        user.groqApiKey, user.resumeText, job.title, job.description, job.company, user.experienceMonths
      );
      await prisma.job.update({
        where: { id: job.id },
        data: { relevanceScore: result.score, relevanceReason: result.reason, isRelevant: result.isRelevant },
      });
      if (result.isRelevant) {
        relevantJobs.push(job);
        push(`  Relevant (${Math.round(result.score * 100)}%): ${job.title} at ${job.company}`);
      }
    }
    push(`${relevantJobs.length} relevant jobs found`);

    // Step 4: Tailor top-k
    const k = maxRelevantJobs === -1 ? relevantJobs.length : maxRelevantJobs;
    const jobsToTailor = relevantJobs.slice(0, k);
    push(`Tailoring resumes for ${jobsToTailor.length} job${jobsToTailor.length !== 1 ? "s" : ""}...`);

    let tailored = 0;
    for (const job of jobsToTailor) {
      const existingApp = await prisma.application.findUnique({ where: { jobId: job.id } });
      if (existingApp) { push(`  Skipped (already tailored): ${job.title}`); continue; }

      const [resume, cover] = await Promise.all([
        tailorResume(user.groqApiKey, user.resumeText, job.title, job.description, job.company),
        generateCoverLetter(user.groqApiKey, user.resumeText, job.title, job.description, job.company),
      ]);
      await prisma.application.create({
        data: { jobId: job.id, userId: user.id, tailoredResume: resume, coverLetter: cover, status: "pending" },
      });
      tailored++;
      push(`  Tailored: ${job.title} at ${job.company}`);
    }

    push(`Done! ${tailored} resumes tailored.`);
    return NextResponse.json({
      success: true, log,
      stats: { scraped: scrapedJobs.length, saved: savedJobs.length, relevant: relevantJobs.length, tailored },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Pipeline error:", error);
    return NextResponse.json({ error: "Pipeline failed" }, { status: 500 });
  }
}
