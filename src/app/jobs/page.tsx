"use client";

import { useState } from "react";

interface RelevanceAnalysis {
  summary: string;
  matchedSkills: string[];
  missingSkills: string[];
  highlights: string[];
}

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  postedAt: string;
  relevanceScore: number;
  relevanceReason: string;
  isRelevant: boolean;
  application?: { id: string; tailoredResume?: string; coverLetter?: string } | null;
}

function parseAnalysis(reason: string): RelevanceAnalysis | null {
  if (!reason) return null;
  try {
    const parsed = JSON.parse(reason);
    if (typeof parsed === "object" && parsed.summary !== undefined) return parsed as RelevanceAnalysis;
  } catch {}
  return { summary: reason, matchedSkills: [], missingSkills: [], highlights: [] };
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadResumePDF(applicationId: string, filename: string): Promise<void> {
  const res = await fetch("/api/resume/generate-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ applicationId }),
  });
  if (!res.ok) throw new Error("PDF generation failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/\.(md|txt)$/, ".pdf");
  a.click();
  URL.revokeObjectURL(url);
}

interface PipelineStats {
  scraped: number;
  saved: number;
  relevant: number;
  tailored: number;
}

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [maxK, setMaxK] = useState(5);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searching, setSearching] = useState(false);
  const [checking, setChecking] = useState(false);
  const [tailoring, setTailoring] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const [viewingDoc, setViewingDoc] = useState<{
    title: string;
    content: string;
    filename: string;
    type: "resume" | "coverLetter";
    applicationId?: string;
  } | null>(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  // "Do It Now" pipeline state
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineLog, setPipelineLog] = useState<string[]>([]);
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);

  // --- Manual step-by-step ---

  const searchJobs = () => {
    if (!query) return;
    setSearching(true);
    setJobs([]);
    setMessage("Connecting to job search...");

    const params = new URLSearchParams({ query, location, limit: "15" });
    const es = new EventSource(`/api/jobs/search/stream?${params.toString()}`);

    es.onmessage = (e) => {
      const data = JSON.parse(e.data) as { type: string; job?: Job; total?: number; message?: string };
      if (data.type === "started") {
        setMessage("Scraping LinkedIn jobs — results appear as they're found...");
      } else if (data.type === "job" && data.job) {
        setJobs((prev) => {
          const updated = [...prev, data.job!];
          setMessage(`Found ${updated.length} job${updated.length !== 1 ? "s" : ""} so far...`);
          return updated;
        });
      } else if (data.type === "done") {
        setMessage(`Search complete — ${data.total} job${data.total !== 1 ? "s" : ""} found`);
        setSearching(false);
        es.close();
      } else if (data.type === "error") {
        setMessage(data.message || "Search failed");
        setSearching(false);
        es.close();
      }
    };

    es.onerror = () => {
      setMessage("Search connection lost. Please try again.");
      setSearching(false);
      es.close();
    };
  };

  const checkRelevance = async () => {
    if (jobs.length === 0) return;
    setChecking(true);
    setMessage("Checking relevance with AI...");
    try {
      const res = await fetch("/api/jobs/check-relevance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: jobs.map((j) => j.id) }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage(data.error);
      } else {
        setJobs((prev) =>
          prev.map((job) => {
            const updated = (data.results || []).find(
              (r: Job) => r.id === job.id
            );
            return updated ? { ...job, ...updated } : job;
          })
        );
        const relevant = (data.results || []).filter(
          (r: Job) => r.isRelevant
        ).length;
        setMessage(`${relevant} out of ${data.results?.length || 0} jobs are relevant to you`);
      }
    } catch {
      setMessage("Relevance check failed.");
    }
    setChecking(false);
  };

  const tailorForJob = async (jobId: string) => {
    setTailoring(jobId);
    setMessage("Tailoring resume & generating cover letter...");
    try {
      const res = await fetch("/api/resume/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage(data.error);
      } else {
        setMessage("Resume tailored!");
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  application: {
                    id: data.application.id,
                    tailoredResume: data.tailoredResume,
                    coverLetter: data.coverLetter,
                  },
                }
              : j
          )
        );
      }
    } catch {
      setMessage("Failed to tailor resume.");
    }
    setTailoring(null);
  };

  // --- "Do It Now" full pipeline ---

  const runPipeline = async () => {
    if (!query) return;
    setPipelineRunning(true);
    setPipelineLog(["Starting pipeline..."]);
    setPipelineStats(null);
    setMessage("");

    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          location,
          maxRelevantJobs: maxK,
        }),
      });
      const data = await res.json();

      if (data.error) {
        setPipelineLog((prev) => [...prev, `Error: ${data.error}`]);
      } else {
        setPipelineLog(data.log || []);
        setPipelineStats(data.stats || null);
      }
    } catch {
      setPipelineLog((prev) => [...prev, "Pipeline failed unexpectedly."]);
    }
    setPipelineRunning(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return "text-green-400";
    if (score >= 0.4) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-1">Job Search</h1>
      <p className="text-muted text-sm mb-6">Search LinkedIn for jobs — step by step or all at once</p>

      {/* Search + Controls */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        <div className="flex gap-3 mb-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchJobs()}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            placeholder="Job title, e.g. React Developer"
          />
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchJobs()}
            className="w-48 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            placeholder="Location"
          />
        </div>

        {/* Max K threshold */}
        <div className="flex items-center gap-3 mb-4">
          <label className="text-xs text-muted whitespace-nowrap">
            Max relevant jobs to tailor (k):
          </label>
          <input
            type="number"
            value={maxK}
            onChange={(e) => setMaxK(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-20 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
            min={1}
            max={15}
          />
          <span className="text-xs text-muted">
            max 15 — limits AI tailoring cost
          </span>
        </div>

        {/* Two modes */}
        <div className="flex gap-3 flex-wrap">
          {/* Manual step-by-step */}
          <button
            onClick={searchJobs}
            disabled={searching || !query}
            className="px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {searching ? "Searching..." : "Search Only"}
          </button>

          {/* Full pipeline */}
          <button
            onClick={runPipeline}
            disabled={pipelineRunning || !query}
            className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {pipelineRunning
              ? "Running Pipeline..."
              : "Do It Now (Search + Check + Tailor)"}
          </button>
        </div>

        {/* After search: manual buttons */}
        {jobs.length > 0 && !pipelineRunning && (
          <div className="flex gap-3 mt-3 pt-3 border-t border-border">
            <button
              onClick={checkRelevance}
              disabled={checking}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              {checking ? "Analyzing..." : "Check Relevance (AI)"}
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 mb-4 text-sm text-accent">
          {message}
        </div>
      )}

      {/* Pipeline Log */}
      {pipelineLog.length > 0 && (
        <div className="bg-card border border-border rounded-lg mb-6 overflow-hidden">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-xs">Pipeline Log</h3>
            {pipelineStats && (
              <div className="flex gap-3 text-xs">
                <span className="text-muted">
                  Scraped: <span className="text-foreground">{pipelineStats.scraped}</span>
                </span>
                <span className="text-muted">
                  Saved: <span className="text-foreground">{pipelineStats.saved}</span>
                </span>
                <span className="text-muted">
                  Relevant: <span className="text-green-400">{pipelineStats.relevant}</span>
                </span>
                <span className="text-muted">
                  Tailored: <span className="text-accent">{pipelineStats.tailored}</span>
                </span>
              </div>
            )}
          </div>
          <div className="p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-0.5">
            {pipelineLog.map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith("  ")
                    ? "text-muted pl-4"
                    : line.startsWith("Error")
                      ? "text-red-400"
                      : line.startsWith("Done")
                        ? "text-green-400"
                        : "text-foreground"
                }
              >
                {line}
              </div>
            ))}
            {pipelineRunning && (
              <div className="text-accent animate-pulse">Processing...</div>
            )}
          </div>
        </div>
      )}

      {/* Document viewer modal */}
      {viewingDoc && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setViewingDoc(null)}
        >
          <div
            className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h3 className="font-semibold text-sm truncate pr-4">{viewingDoc.title}</h3>
              <div className="flex gap-2 shrink-0">
                {viewingDoc.type === "resume" && viewingDoc.applicationId ? (
                  <button
                    disabled={downloadingPDF}
                    onClick={async () => {
                      setDownloadingPDF(true);
                      try {
                        await downloadResumePDF(viewingDoc.applicationId!, viewingDoc.filename);
                      } catch {
                        alert("PDF generation failed. Please try again.");
                      } finally {
                        setDownloadingPDF(false);
                      }
                    }}
                    className="text-xs px-3 py-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors disabled:opacity-50"
                  >
                    {downloadingPDF ? "Generating PDF..." : "Download PDF"}
                  </button>
                ) : (
                  <button
                    onClick={() => downloadText(viewingDoc.filename, viewingDoc.content)}
                    className="text-xs px-3 py-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors"
                  >
                    Download .txt
                  </button>
                )}
                <button
                  onClick={() => setViewingDoc(null)}
                  className="text-xs px-3 py-1.5 bg-card border border-border rounded-lg hover:border-accent transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto">
              {viewingDoc.type === "resume" ? (
                <div className="space-y-1">
                  {viewingDoc.content.split("\n").map((line, i) => {
                    if (/^# /.test(line)) return <p key={i} className="text-base font-bold text-center text-foreground mt-1 mb-2">{line.slice(2)}</p>;
                    if (/^## /.test(line)) return <p key={i} className="text-xs font-bold text-accent uppercase tracking-wider border-b border-border pb-1 mt-4 mb-2">{line.slice(3)}</p>;
                    if (/^### /.test(line)) return <p key={i} className="text-xs font-semibold text-foreground mt-3">{line.slice(4)}</p>;
                    if (/^[-*] /.test(line)) return <p key={i} className="text-xs text-muted pl-3">• {line.slice(2)}</p>;
                    if (line.trim() === "") return <div key={i} className="h-1" />;
                    return <p key={i} className="text-xs text-muted">{line}</p>;
                  })}
                </div>
              ) : (
                <pre className="text-xs text-muted whitespace-pre-wrap leading-relaxed font-mono">
                  {viewingDoc.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Job List */}
      <div className="space-y-3">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="bg-card border border-border rounded-lg overflow-hidden"
          >
            <div
              className="p-4 cursor-pointer hover:bg-card-hover transition-colors"
              onClick={() =>
                setExpandedJob(expandedJob === job.id ? null : job.id)
              }
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{job.title}</h3>
                    {job.relevanceScore > 0 && (
                      <span
                        className={`text-xs font-mono ${getScoreColor(
                          job.relevanceScore
                        )}`}
                      >
                        {Math.round(job.relevanceScore * 100)}%
                      </span>
                    )}
                    {job.isRelevant && (
                      <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">
                        Relevant
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {job.company} · {job.location}
                    {job.postedAt && ` · ${job.postedAt}`}
                  </p>
                  {job.relevanceReason && (
                    <p className="text-xs text-muted/70 mt-1 italic">
                      {job.relevanceReason}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-3">
                  {job.url && (
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                    </a>
                  )}
                  {!job.application ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        tailorForJob(job.id);
                      }}
                      disabled={tailoring === job.id}
                      className="text-xs px-3 py-1 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors disabled:opacity-50"
                    >
                      {tailoring === job.id ? "Tailoring..." : "Tailor Resume"}
                    </button>
                  ) : (
                    <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {job.application.tailoredResume && (
                        <button
                          onClick={() =>
                            setViewingDoc({
                              title: `Tailored Resume — ${job.title} @ ${job.company}`,
                              content: job.application!.tailoredResume!,
                              filename: `resume-${job.company.toLowerCase().replace(/\s+/g, "-")}.pdf`,
                              type: "resume",
                              applicationId: job.application!.id,
                            })
                          }
                          className="text-xs px-2.5 py-1 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors"
                        >
                          Resume
                        </button>
                      )}
                      {job.application.coverLetter && (
                        <button
                          onClick={() =>
                            setViewingDoc({
                              title: `Cover Letter — ${job.title} @ ${job.company}`,
                              content: job.application!.coverLetter!,
                              filename: `cover-letter-${job.company.toLowerCase().replace(/\s+/g, "-")}.txt`,
                              type: "coverLetter",
                            })
                          }
                          className="text-xs px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
                        >
                          Cover Letter
                        </button>
                      )}
                      {!job.application.tailoredResume && (
                        <span className="text-xs text-green-400">Tailored ✓</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {expandedJob === job.id && (
              <div className="px-4 pb-4 border-t border-border pt-3 space-y-4">
                {/* AI Analysis */}
                {job.relevanceReason && (() => {
                  const analysis = parseAnalysis(job.relevanceReason);
                  if (!analysis) return null;
                  return (
                    <div>
                      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Match Analysis</p>
                      {analysis.summary && (
                        <p className="text-xs text-foreground mb-3">{analysis.summary}</p>
                      )}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        {analysis.matchedSkills.length > 0 && (
                          <div>
                            <p className="text-xs text-green-400 font-medium mb-1.5">Matched Skills</p>
                            <div className="flex flex-wrap gap-1">
                              {analysis.matchedSkills.map((s) => (
                                <span key={s} className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {analysis.missingSkills.length > 0 && (
                          <div>
                            <p className="text-xs text-red-400 font-medium mb-1.5">Gaps</p>
                            <div className="flex flex-wrap gap-1">
                              {analysis.missingSkills.map((s) => (
                                <span key={s} className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {analysis.highlights.length > 0 && (
                        <ul className="space-y-1">
                          {analysis.highlights.map((h, i) => (
                            <li key={i} className="text-xs text-muted flex gap-2">
                              <span className="text-accent shrink-0">·</span>
                              {h}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}

                {/* Job Description */}
                {job.description && (
                  <div>
                    <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Job Description</p>
                    <p className="text-xs text-muted whitespace-pre-wrap leading-relaxed">
                      {job.description.slice(0, 1000)}
                      {job.description.length > 1000 && "..."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
