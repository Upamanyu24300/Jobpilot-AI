"use client";

import { useEffect, useState } from "react";

interface Stats {
  totalJobs: number;
  relevantJobs: number;
  applications: number;
  applied: number;
  interviews: number;
  offers: number;
}

interface RecentApplication {
  id: string;
  status: string;
  createdAt: string;
  job: { title: string; company: string; location: string };
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentApplication[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/jobs/search?limit=0").then((r) => r.json()),
      fetch("/api/applications").then((r) => r.json()),
    ]).then(([jobs, apps]) => {

      const allApps = apps.applications || [];
      setStats({
        totalJobs: jobs.total || 0,
        relevantJobs: (jobs.jobs || []).filter((j: { isRelevant: boolean }) => j.isRelevant).length,
        applications: allApps.length,
        applied: allApps.filter((a: RecentApplication) => a.status === "applied").length,
        interviews: allApps.filter((a: RecentApplication) => a.status === "interview").length,
        offers: allApps.filter((a: RecentApplication) => a.status === "offer").length,
      });
      setRecent(allApps.slice(0, 5));
    });
  }, []);

  const statCards = stats
    ? [
        { label: "Jobs Found", value: stats.totalJobs, color: "text-accent" },
        { label: "Relevant", value: stats.relevantJobs, color: "text-success" },
        { label: "Applications", value: stats.applications, color: "text-warning" },
        { label: "Applied", value: stats.applied, color: "text-accent" },
        { label: "Interviews", value: stats.interviews, color: "text-warning" },
        { label: "Offers", value: stats.offers, color: "text-success" },
      ]
    : [];

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-500",
    applied: "bg-blue-500/10 text-blue-500",
    interview: "bg-purple-500/10 text-purple-500",
    rejected: "bg-red-500/10 text-red-500",
    offer: "bg-green-500/10 text-green-500",
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
      <p className="text-muted text-sm mb-6">Your job application overview</p>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {statCards.map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-lg p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card border border-border rounded-lg">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-sm">Recent Applications</h2>
        </div>
        {recent.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">
            No applications yet. Start by{" "}
            <a href="/jobs" className="text-accent underline">
              searching for jobs
            </a>
            .
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((app) => (
              <div key={app.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{app.job.title}</p>
                  <p className="text-xs text-muted">
                    {app.job.company} · {app.job.location}
                  </p>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                    statusColors[app.status] || ""
                  }`}
                >
                  {app.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
