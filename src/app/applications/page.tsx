"use client";

import { useEffect, useState } from "react";

interface ResumeSkill { category: string; items: string }
interface ResumeEntry {
  left: string; right: string;
  sub1?: string; sub2?: string; detail?: string;
  bullets: string[];
}
interface ResumeSection { title: string; entries: ResumeEntry[] }
interface StructuredResume {
  name: string; contact: string; summary: string;
  skills: ResumeSkill[]; sections: ResumeSection[];
}

interface Application {
  id: string;
  status: string;
  tailoredResume: string;
  coverLetter: string;
  notes: string;
  appliedAt: string | null;
  createdAt: string;
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
    url: string;
  };
}

function parseResume(raw: string): StructuredResume | null {
  try {
    const p = JSON.parse(raw);
    if (p && p.name && Array.isArray(p.sections)) return p as StructuredResume;
  } catch { /* fall through */ }
  return null;
}

function StructuredResumeView({ resume }: { resume: StructuredResume }) {
  return (
    <div className="space-y-3 text-xs">
      <div className="text-center">
        <p className="text-sm font-bold text-foreground">{resume.name}</p>
        {resume.contact && <p className="text-muted mt-0.5">{resume.contact}</p>}
      </div>
      {resume.summary && (
        <div>
          <p className="text-[10px] font-bold text-accent uppercase tracking-wider border-b border-border pb-1 mb-2">Summary</p>
          <p className="text-muted leading-relaxed">{resume.summary}</p>
        </div>
      )}
      {resume.skills.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-accent uppercase tracking-wider border-b border-border pb-1 mb-2">Skills</p>
          {resume.skills.map((s, i) => (
            <p key={i} className="text-muted mb-1">
              <span className="font-semibold text-foreground">{s.category}: </span>{s.items}
            </p>
          ))}
        </div>
      )}
      {resume.sections.map((section, si) => (
        <div key={si}>
          <p className="text-[10px] font-bold text-accent uppercase tracking-wider border-b border-border pb-1 mb-2">{section.title}</p>
          {section.entries.map((entry, ei) => (
            <div key={ei} className="mb-3">
              <div className="flex justify-between items-baseline">
                <span className="font-semibold text-foreground">{entry.left}</span>
                <span className="text-muted text-[10px] ml-2 shrink-0">{entry.right}</span>
              </div>
              {entry.sub1 && <p className="text-muted italic">{entry.sub1}</p>}
              {entry.sub2 && <p className="text-muted">{entry.sub2}</p>}
              {entry.detail && <p className="text-muted">{entry.detail}</p>}
              {entry.bullets.map((b, bi) => (
                <p key={bi} className="text-muted pl-3 mt-0.5">• {b}</p>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MarkdownResumeView({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split("\n").map((line, i) => {
        if (/^# /.test(line)) return <p key={i} className="text-base font-bold text-center text-foreground mt-1 mb-2">{line.slice(2)}</p>;
        if (/^## /.test(line)) return <p key={i} className="text-xs font-bold text-accent uppercase tracking-wider border-b border-border pb-1 mt-4 mb-2">{line.slice(3)}</p>;
        if (/^### /.test(line)) return <p key={i} className="text-xs font-semibold text-foreground mt-3">{line.slice(4)}</p>;
        if (/^[-*] /.test(line)) return <p key={i} className="text-xs text-muted pl-3">• {line.slice(2)}</p>;
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i} className="text-xs text-muted">{line}</p>;
      })}
    </div>
  );
}

const statusOptions = ["pending", "applied", "interview", "rejected", "offer"];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  applied: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  interview: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  rejected: "bg-red-500/10 text-red-500 border-red-500/20",
  offer: "bg-green-500/10 text-green-500 border-green-500/20",
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"resume" | "cover">("resume");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    const res = await fetch("/api/applications");
    const data = await res.json();
    setApplications(data.applications || []);
  };

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch("/api/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const data = await res.json();
    if (data.application) {
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...data.application } : a))
      );
    }
  };

  const downloadResume = async (app: Application) => {
    try {
      const res = await fetch("/api/resume/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: app.id }),
      });
      if (!res.ok) { setMessage("Failed to generate PDF."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume-${app.job.company.toLowerCase().replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage("Failed to download resume.");
    }
  };

  const deleteApplication = async (id: string) => {
    await fetch("/api/applications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setApplications((prev) => prev.filter((a) => a.id !== id));
  };

  const counts = statusOptions.reduce(
    (acc, s) => {
      acc[s] = applications.filter((a) => a.status === s).length;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-1">Applications</h1>
      <p className="text-muted text-sm mb-6">Track your tailored applications</p>

      {message && (
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 mb-4 text-sm text-accent">
          {message}
        </div>
      )}

      {/* Status Summary */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {statusOptions.map((s) => (
          <span
            key={s}
            className={`text-xs px-3 py-1.5 rounded-full border capitalize ${statusColors[s]}`}
          >
            {s}: {counts[s]}
          </span>
        ))}
      </div>

      {applications.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-muted text-sm">
            No applications yet. Go to{" "}
            <a href="/jobs" className="text-accent underline">
              Job Search
            </a>{" "}
            to find jobs and tailor your resume.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <div
              key={app.id}
              className="bg-card border border-border rounded-lg overflow-hidden"
            >
              <div
                className="p-4 cursor-pointer hover:bg-card-hover transition-colors"
                onClick={() =>
                  setExpanded(expanded === app.id ? null : app.id)
                }
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">{app.job.title}</h3>
                    <p className="text-xs text-muted mt-0.5">
                      {app.job.company} · {app.job.location}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={app.status}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateStatus(app.id, e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs bg-background border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-accent capitalize"
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadResume(app);
                      }}
                      className="text-xs px-3 py-1 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors"
                    >
                      Download PDF
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteApplication(app.id);
                      }}
                      className="text-xs px-2 py-1 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {expanded === app.id && (
                <div className="border-t border-border">
                  <div className="flex border-b border-border">
                    <button
                      onClick={() => setViewMode("resume")}
                      className={`px-4 py-2 text-xs font-medium ${
                        viewMode === "resume"
                          ? "text-accent border-b-2 border-accent"
                          : "text-muted"
                      }`}
                    >
                      Tailored Resume
                    </button>
                    <button
                      onClick={() => setViewMode("cover")}
                      className={`px-4 py-2 text-xs font-medium ${
                        viewMode === "cover"
                          ? "text-accent border-b-2 border-accent"
                          : "text-muted"
                      }`}
                    >
                      Cover Letter
                    </button>
                  </div>
                  <div className="p-4 max-h-96 overflow-y-auto">
                    {viewMode === "resume" ? (
                      (() => {
                        const structured = parseResume(app.tailoredResume);
                        return structured
                          ? <StructuredResumeView resume={structured} />
                          : <MarkdownResumeView text={app.tailoredResume} />;
                      })()
                    ) : (
                      <pre className="text-xs text-muted whitespace-pre-wrap leading-relaxed font-mono">
                        {app.coverLetter}
                      </pre>
                    )}
                  </div>
                  {app.job.url && (
                    <div className="px-4 pb-3">
                      <a
                        href={app.job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline"
                      >
                        View Original Job Posting
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
