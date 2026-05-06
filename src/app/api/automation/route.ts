import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/user";
import { scrapeLinkedInJobs } from "@/lib/linkedin";
import { checkJobRelevance, tailorResume, generateCoverLetter } from "@/lib/groq";

export async function GET() {
  try {
    const user = await requireAuth();
    const configs = await prisma.automationConfig.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ configs });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();

    if (body.action === "create") {
      const config = await prisma.automationConfig.create({
        data: {
          userId: user.id,
          searchQuery: body.searchQuery || "",
          location: body.location || "",
          cronExpression: body.cronExpression || "0 9 * * *",
          autoTailor: body.autoTailor ?? true,
          maxRelevantJobs: body.maxRelevantJobs ?? -1,
          isActive: true,
        },
      });
      return NextResponse.json({ config });
    }

    if (body.action === "toggle") {
      const config = await prisma.automationConfig.update({
        where: { id: body.id, userId: user.id },
        data: { isActive: body.isActive },
      });
      return NextResponse.json({ config });
    }

    if (body.action === "delete") {
      await prisma.automationConfig.delete({ where: { id: body.id, userId: user.id } });
      return NextResponse.json({ success: true });
    }

    if (body.action === "run") {
      const config = await prisma.automationConfig.findFirst({
        where: { id: body.id, userId: user.id },
      });
      if (!config) {
        return NextResponse.json({ error: "Config not found" }, { status: 404 });
      }

      if (!user.groqApiKey || !user.apifyToken || !user.resumeText) {
        return NextResponse.json(
          { error: "Please set up your Groq API key, Apify token, and resume in settings first" },
          { status: 400 }
        );
      }

      // 1. Scrape jobs
      const scrapedJobs = await scrapeLinkedInJobs(user.apifyToken, config.searchQuery, config.location);

      // 2. Save new jobs (descriptions already included from Apify)
      const savedJobs = [];
      for (const job of scrapedJobs.slice(0, 25)) {
        const existing = await prisma.job.findFirst({
          where: { url: job.url, userId: user.id },
        });
        if (existing) continue;

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

      // 3. Check relevance
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
        if (result.isRelevant) relevantJobs.push(job);
      }

      // 4. Auto-tailor (respecting k threshold)
      let tailored = 0;
      if (config.autoTailor) {
        const k = config.maxRelevantJobs === -1 ? relevantJobs.length : config.maxRelevantJobs;
        for (const job of relevantJobs.slice(0, k)) {
          const existingApp = await prisma.application.findUnique({ where: { jobId: job.id } });
          if (existingApp) continue;

          const [resume, cover] = await Promise.all([
            tailorResume(user.groqApiKey, user.resumeText, job.title, job.description, job.company),
            generateCoverLetter(user.groqApiKey, user.resumeText, job.title, job.description, job.company),
          ]);
          await prisma.application.create({
            data: { jobId: job.id, userId: user.id, tailoredResume: resume, coverLetter: cover, status: "pending" },
          });
          tailored++;
        }
      }

      await prisma.automationConfig.update({
        where: { id: config.id },
        data: { lastRun: new Date() },
      });

      return NextResponse.json({
        success: true, jobsFound: scrapedJobs.length,
        newJobs: savedJobs.length, relevantJobs: relevantJobs.length, tailored,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Automation error:", error);
    return NextResponse.json({ error: "Automation failed" }, { status: 500 });
  }
}
