import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/user";
import { scrapeLinkedInJobs } from "@/lib/linkedin";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { query, location, page = 0 } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }
    if (!user.apifyToken) {
      return NextResponse.json({ error: "Please set your Apify token in settings" }, { status: 400 });
    }

    const MAX = 15;
    const jobs = await scrapeLinkedInJobs(user.apifyToken, query, location || "", MAX);

    // Sequential saves to avoid exhausting the DB connection pool
    const savedJobs = [];
    for (const job of jobs.slice(0, MAX)) {
      try {
        if (job.url) {
          const existing = await prisma.job.findFirst({
            where: { url: job.url, userId: user.id },
          });
          if (existing) { savedJobs.push(existing); continue; }
        }
        const created = await prisma.job.create({
          data: {
            title: job.title,
            company: job.company,
            location: job.location,
            description: job.description,
            url: job.url,
            salary: job.salary,
            jobType: job.jobType,
            postedAt: job.postedAt,
            source: "linkedin",
            userId: user.id,
          },
        });
        savedJobs.push(created);
      } catch (e) {
        console.error("Failed to save job:", e);
      }
    }

    return NextResponse.json({ jobs: savedJobs, total: savedJobs.length });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Job search error:", error);
    return NextResponse.json({ error: "Failed to search jobs" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await requireAuth();

    const jobs = await prisma.job.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { application: true },
    });

    const total = await prisma.job.count({ where: { userId: user.id } });

    return NextResponse.json({ jobs, total });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
