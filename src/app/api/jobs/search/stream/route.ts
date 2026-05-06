import { NextRequest } from "next/server";
import { ApifyClient } from "apify-client";
import { requireAuth } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import {
  normalizeLinkedInItem,
  buildLinkedInSearchUrl,
  ACTOR_ID,
} from "@/lib/linkedin";

const MAX_JOBS = 15;
const POLL_MS = 3000;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get("query") || "";
  const location = searchParams.get("location") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || String(MAX_JOBS)), MAX_JOBS);

  const encoder = new TextEncoder();
  let aborted = false;
  let apifyRunId: string | null = null;
  let apifyToken: string | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        if (aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      try {
        const user = await requireAuth();
        apifyToken = user.apifyToken || null;

        if (!apifyToken) {
          send({ type: "error", message: "Please set your Apify token in settings" });
          controller.close();
          return;
        }
        if (!query) {
          send({ type: "error", message: "Search query is required" });
          controller.close();
          return;
        }

        const client = new ApifyClient({ token: apifyToken });
        const run = await client.actor(ACTOR_ID).start(
          { urls: [buildLinkedInSearchUrl(query, location)], maxItems: limit },
          { memory: 256 }
        );
        apifyRunId = run.id;
        send({ type: "started" });

        const seenApifyIds = new Set<string>();
        let savedCount = 0;
        let runDone = false;

        while (!aborted && !runDone && savedCount < limit) {
          await new Promise((r) => setTimeout(r, POLL_MS));
          if (aborted) break;

          const [runInfo, dataset] = await Promise.all([
            client.run(run.id).get(),
            client.dataset(run.defaultDatasetId).listItems({ limit: limit * 3 }),
          ]);

          const status = runInfo?.status;
          if (status !== "RUNNING" && status !== "READY") runDone = true;

          for (const rawItem of dataset.items as Record<string, unknown>[]) {
            const apifyId = String(rawItem.id || rawItem.trackingId || "");
            if (apifyId && seenApifyIds.has(apifyId)) continue;
            if (apifyId) seenApifyIds.add(apifyId);

            const job = normalizeLinkedInItem(rawItem);
            if (!job.title) continue;

            try {
              let dbJob;
              if (job.url) {
                const existing = await prisma.job.findFirst({
                  where: { url: job.url, userId: user.id },
                });
                if (existing) {
                  dbJob = existing;
                }
              }
              if (!dbJob) {
                dbJob = await prisma.job.create({
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
              }
              savedCount++;
              send({ type: "job", job: dbJob });
              if (savedCount >= limit) break;
            } catch (e) {
              console.error("Failed to save job:", e);
            }
          }
        }

        if (!runDone) {
          await client.run(run.id).abort().catch(() => {});
        }

        send({ type: "done", total: savedCount });
        controller.close();
      } catch (e) {
        if (e instanceof Error && e.message === "UNAUTHORIZED") {
          send({ type: "error", message: "Please sign in first" });
        } else {
          const msg = e instanceof Error ? e.message : "Search failed";
          send({ type: "error", message: msg });
        }
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      aborted = true;
      // Abort the Apify run when the client disconnects
      if (apifyRunId && apifyToken) {
        new ApifyClient({ token: apifyToken })
          .run(apifyRunId)
          .abort()
          .catch(() => {});
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
