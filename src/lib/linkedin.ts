import { ApifyClient } from "apify-client";

export interface LinkedInJob {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  salary: string;
  jobType: string;
  postedAt: string;
}

interface CuriousCoderItem {
  title: string;
  companyName: string;
  location: string;
  descriptionText: string;
  descriptionHtml: string;
  link: string;
  applyUrl: string;
  salary: string;
  employmentType: string;
  postedAt: string;
}

export function normalizeLinkedInItem(item: Record<string, unknown>): LinkedInJob {
  const raw = item as CuriousCoderItem;

  const description =
    typeof raw.descriptionText === "string" && raw.descriptionText.trim()
      ? raw.descriptionText
      : typeof raw.descriptionHtml === "string"
        ? raw.descriptionHtml
            .replace(/<[^>]+>/g, " ")
            .replace(/&[a-z]+;/gi, " ")
            .replace(/\s+/g, " ")
            .trim()
        : "";

  return {
    title: raw.title || "",
    company: raw.companyName || "Unknown",
    location: raw.location || "",
    description: description.slice(0, 5000),
    url: raw.link || raw.applyUrl || "",
    salary: raw.salary || "",
    jobType: raw.employmentType || "",
    postedAt: raw.postedAt || "",
  };
}

export function buildLinkedInSearchUrl(query: string, location: string): string {
  const params = new URLSearchParams({
    keywords: query,
    ...(location && { location }),
    f_TPR: "r2592000",
  });
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

const POLL_MS = 3000;
const ACTOR_ID = "hKByXkMQaC5Qt9UMN"; // curious_coder/linkedin-jobs-scraper (free)

// Blocking version used by pipeline — aborts the Apify run once enough items are collected.
export async function scrapeLinkedInJobs(
  apifyToken: string,
  query: string,
  location: string,
  limit: number = 15
): Promise<LinkedInJob[]> {
  const client = new ApifyClient({ token: apifyToken });
  const run = await client.actor(ACTOR_ID).start(
    { urls: [buildLinkedInSearchUrl(query, location)], maxItems: limit },
    { memory: 256 }
  );

  const seenIds = new Set<string>();
  const results: LinkedInJob[] = [];
  let runDone = false;

  while (!runDone && results.length < limit) {
    await new Promise((r) => setTimeout(r, POLL_MS));

    const [runInfo, dataset] = await Promise.all([
      client.run(run.id).get(),
      client.dataset(run.defaultDatasetId).listItems({ limit: limit * 3 }),
    ]);

    const status = runInfo?.status;
    if (status !== "RUNNING" && status !== "READY") runDone = true;

    for (const raw of dataset.items as Record<string, unknown>[]) {
      const id = String(raw.id || raw.trackingId || "");
      if (id && seenIds.has(id)) continue;
      if (id) seenIds.add(id);
      const job = normalizeLinkedInItem(raw);
      if (job.title) results.push(job);
      if (results.length >= limit) break;
    }
  }

  if (!runDone) await client.run(run.id).abort().catch(() => {});
  return results.slice(0, limit);
}

export { ACTOR_ID };
