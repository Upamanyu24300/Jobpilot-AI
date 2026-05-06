import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scrapeLinkedInJobs } from "@/lib/linkedin";
import { checkJobRelevance, tailorResume, generateCoverLetter } from "@/lib/groq";
import { CronExpressionParser } from "cron-parser";
import { decrypt } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const configs = await prisma.automationConfig.findMany({
    where: { isActive: true },
    include: { user: true },
  });

  let ran = 0;
  const results: { configId: string; status: string; detail?: string }[] = [];

  for (const config of configs) {
    try {
      // Determine if this config's cron expression was due since its last run.
      const interval = CronExpressionParser.parse(config.cronExpression, { currentDate: now });
      const prevFire = interval.prev().toDate();
      const isDue = !config.lastRun || config.lastRun < prevFire;

      if (!isDue) {
        results.push({ configId: config.id, status: "skipped" });
        continue;
      }

      const user = config.user;
      const groqApiKey = user.groqApiKey ? decrypt(user.groqApiKey) : "";
      const apifyToken = user.apifyToken ? decrypt(user.apifyToken) : "";
      if (!groqApiKey || !apifyToken || !user.resumeText) {
        results.push({ configId: config.id, status: "skipped", detail: "missing keys/resume" });
        continue;
      }

      // 1. Scrape
      const scraped = await scrapeLinkedInJobs(apifyToken, config.searchQuery, config.location);

      // 2. Save new jobs
      const saved = [];
      for (const job of scraped.slice(0, 25)) {
        const existing = await prisma.job.findFirst({ where: { url: job.url, userId: user.id } });
        if (existing) continue;
        const row = await prisma.job.create({
          data: {
            title: job.title, company: job.company, location: job.location,
            description: job.description, url: job.url, salary: job.salary,
            jobType: job.jobType, postedAt: job.postedAt,
            source: "linkedin", userId: user.id,
          },
        });
        saved.push(row);
      }

      // 3. Check relevance
      const relevant = [];
      for (const job of saved) {
        if (!job.description) continue;
        const result = await checkJobRelevance(
          groqApiKey, user.resumeText, job.title, job.description, job.company, user.experienceMonths
        );
        await prisma.job.update({
          where: { id: job.id },
          data: { relevanceScore: result.score, relevanceReason: result.reason, isRelevant: result.isRelevant },
        });
        if (result.isRelevant) relevant.push(job);
      }

      // 4. Auto-tailor top-k
      let tailored = 0;
      if (config.autoTailor) {
        const k = config.maxRelevantJobs === -1 ? relevant.length : config.maxRelevantJobs;
        for (const job of relevant.slice(0, k)) {
          const exists = await prisma.application.findUnique({ where: { jobId: job.id } });
          if (exists) continue;
          const [resume, cover] = await Promise.all([
            tailorResume(groqApiKey, user.resumeText, job.title, job.description, job.company),
            generateCoverLetter(groqApiKey, user.resumeText, job.title, job.description, job.company),
          ]);
          await prisma.application.create({
            data: { jobId: job.id, userId: user.id, tailoredResume: resume, coverLetter: cover, status: "pending" },
          });
          tailored++;
        }
      }

      await prisma.automationConfig.update({
        where: { id: config.id },
        data: { lastRun: now },
      });

      ran++;
      results.push({
        configId: config.id,
        status: "ran",
        detail: `scraped=${scraped.length} saved=${saved.length} relevant=${relevant.length} tailored=${tailored}`,
      });
    } catch (err) {
      results.push({ configId: config.id, status: "error", detail: String(err) });
    }
  }

  return NextResponse.json({ ok: true, ran, total: configs.length, results });
}
