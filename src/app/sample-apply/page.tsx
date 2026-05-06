"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResumeAnalysis {
  inferredRole: string;
  experienceLevel: string;
  yearsEstimate: string;
  keywords: string[];
  industries: string[];
  searchQuery: string;
  summary: string;
}

interface LinkedInJob {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  salary: string;
  jobType: string;
  postedAt: string;
}

interface RelevanceAnalysis {
  summary: string;
  matchedSkills: string[];
  missingSkills: string[];
  highlights: string[];
}

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

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_LABELS = ["Analyze", "Search", "Match", "Tailor", "Apply"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEP_LABELS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  done
                    ? "bg-accent border-accent text-background"
                    : active
                    ? "border-accent text-accent bg-transparent"
                    : "border-border text-muted bg-transparent"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] mt-1 ${active ? "text-accent font-medium" : done ? "text-foreground" : "text-muted"}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`h-0.5 w-12 mx-1 mb-5 ${i < current ? "bg-accent" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Resume renderer helpers ──────────────────────────────────────────────────

function StructuredResumePanel({
  resume,
  compare,
  highlight,
}: {
  resume: StructuredResume;
  compare?: StructuredResume;
  highlight?: boolean;
}) {
  function isDiff(a?: string, b?: string) {
    return highlight && a !== undefined && b !== undefined && a !== b;
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="text-center mb-3">
        <p className="text-sm font-bold text-foreground">{resume.name}</p>
        {resume.contact && <p className="text-muted mt-0.5 text-[10px]">{resume.contact}</p>}
      </div>

      {resume.summary && (
        <div>
          <p className="text-[10px] font-bold text-accent uppercase tracking-wider border-b border-border pb-1 mb-1.5">Summary</p>
          <p
            className={`text-muted leading-relaxed text-[11px] rounded px-1.5 py-1 ${
              isDiff(compare?.summary, resume.summary)
                ? "bg-yellow-500/10 border border-yellow-500/20"
                : ""
            }`}
          >
            {resume.summary}
          </p>
        </div>
      )}

      {resume.skills.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-accent uppercase tracking-wider border-b border-border pb-1 mb-1.5">Skills</p>
          {resume.skills.map((s, i) => (
            <p key={i} className="text-muted mb-0.5 text-[11px]">
              <span className="font-semibold text-foreground">{s.category}: </span>{s.items}
            </p>
          ))}
        </div>
      )}

      {resume.sections.map((section, si) => {
        const compareSection = compare?.sections[si];
        return (
          <div key={si}>
            <p className="text-[10px] font-bold text-accent uppercase tracking-wider border-b border-border pb-1 mb-1.5">{section.title}</p>
            {section.entries.map((entry, ei) => {
              const compareEntry = compareSection?.entries[ei];
              return (
                <div key={ei} className="mb-2.5">
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold text-foreground text-[11px]">{entry.left}</span>
                    <span className="text-muted text-[10px] ml-2 shrink-0">{entry.right}</span>
                  </div>
                  {entry.sub1 && <p className="text-muted italic text-[10px]">{entry.sub1}</p>}
                  {entry.sub2 && <p className="text-muted text-[10px]">{entry.sub2}</p>}
                  {entry.detail && <p className="text-muted text-[10px]">{entry.detail}</p>}
                  {entry.bullets.map((b, bi) => {
                    const origBullet = compareEntry?.bullets[bi];
                    const changed = isDiff(origBullet, b);
                    return (
                      <p
                        key={bi}
                        className={`pl-3 mt-0.5 text-[11px] rounded px-1 ${
                          changed ? "bg-yellow-500/10 border border-yellow-500/20 text-foreground" : "text-muted"
                        }`}
                      >
                        • {b}
                      </p>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? "text-green-400" : pct >= 40 ? "text-yellow-400" : "text-red-400";
  const ring = pct >= 70 ? "border-green-400/30" : pct >= 40 ? "border-yellow-400/30" : "border-red-400/30";
  const bg = pct >= 70 ? "bg-green-400/10" : pct >= 40 ? "bg-yellow-400/10" : "bg-red-400/10";
  return (
    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full border-2 ${ring} ${bg}`}>
      <span className={`text-xl font-bold ${color}`}>{pct}%</span>
    </div>
  );
}

// ─── Loading state ────────────────────────────────────────────────────────────

function StepLoader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-6 text-muted text-sm">
      <span className="inline-block w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      {label}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Phase = "welcome" | "step1" | "step2" | "step3" | "step4" | "step5" | "done";

export default function SampleApplyPage() {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [job, setJob] = useState<LinkedInJob | null>(null);
  const [match, setMatch] = useState<{ score: number; isRelevant: boolean; analysis: RelevanceAnalysis } | null>(null);
  const [tailor, setTailor] = useState<{ tailored: StructuredResume | null; original: StructuredResume | null; tailoredRaw: string; coverLetter: string } | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  const stepIndex: Record<Phase, number> = {
    welcome: -1, step1: 0, step2: 1, step3: 2, step4: 3, step5: 4, done: 4,
  };
  const currentStep = stepIndex[phase] ?? -1;

  async function call(action: string, extra: Record<string, unknown> = {}) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/sample-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      return data;
    } finally {
      setLoading(false);
    }
  }

  // Step 1
  async function runAnalyze() {
    setPhase("step1");
    try {
      const data = await call("analyze");
      setAnalysis(data.analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Step 2
  async function runSearch() {
    if (!analysis) return;
    setPhase("step2");
    try {
      const data = await call("search", { searchQuery: analysis.searchQuery });
      await handleJobFound(data.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Step 3 — auto-starts after step 2 result arrives
  async function runMatch(foundJob: LinkedInJob) {
    setPhase("step3");
    try {
      const data = await call("match", { job: foundJob });
      setMatch(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Step 4
  async function runTailor() {
    if (!job) return;
    setPhase("step4");
    try {
      const data = await call("tailor", { job });
      setTailor(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Step 5
  async function runApply() {
    if (!job || !tailor) return;
    setPhase("step5");
    try {
      const data = await call("apply", {
        job,
        tailoredRaw: tailor.tailoredRaw,
        coverLetter: tailor.coverLetter,
      });
      setApplicationId(data.applicationId);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Called when search result is received — kick off match automatically
  async function handleJobFound(foundJob: LinkedInJob) {
    setJob(foundJob);
    await runMatch(foundJob);
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Sample Apply</h1>
      <p className="text-muted text-sm mb-6">
        See exactly how JobPilot AI works — every AI decision, fully transparent.
      </p>

      {/* Step indicator — show once started */}
      {phase !== "welcome" && phase !== "done" && (
        <StepIndicator current={currentStep} />
      )}

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-sm text-red-400">
          {error}
          {error.includes("Settings") && (
            <Link href="/settings" className="ml-2 underline hover:text-red-300">Go to Settings →</Link>
          )}
        </div>
      )}

      {/* ── WELCOME ── */}
      {phase === "welcome" && (
        <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
          <div className="text-4xl mb-2">▶</div>
          <h2 className="text-xl font-bold">See the full pipeline, step by step</h2>
          <div className="text-muted text-sm max-w-lg mx-auto space-y-2 text-left">
            <p>We&apos;ll run through one complete job application live, showing you everything:</p>
            <ul className="space-y-1.5 mt-3">
              {[
                "What AI reads from your resume (keywords, role, experience)",
                "What job it found and why it picked it",
                "How well your resume matches the job — gaps and strengths",
                "Exactly what changed when your resume was tailored",
                "The final application details before anything is saved",
              ].map((item, i) => (
                <li key={i} className="flex gap-2 items-start">
                  <span className="text-accent mt-0.5 shrink-0">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={runAnalyze}
            className="mt-4 px-6 py-3 bg-accent text-background rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors"
          >
            Start Sample Apply
          </button>
        </div>
      )}

      {/* ── STEP 1: RESUME ANALYSIS ── */}
      {(phase === "step1" || currentStep > 0) && (
        <div className={`bg-card border rounded-xl p-6 mb-4 ${currentStep > 0 && phase !== "step1" ? "border-border opacity-80" : "border-accent/30"}`}>
          <div className="flex items-center gap-2 mb-4">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${currentStep > 0 ? "bg-accent text-background" : "border-2 border-accent text-accent"}`}>
              {currentStep > 0 ? "✓" : "1"}
            </span>
            <h3 className="font-semibold">Resume Analysis</h3>
          </div>

          {phase === "step1" && loading && <StepLoader label="Analyzing your resume…" />}

          {analysis && (
            <div className="space-y-4">
              {/* Collapsed summary when past this step */}
              {phase !== "step1" ? (
                <p className="text-sm text-muted">
                  Found: <span className="text-foreground font-medium">{analysis.inferredRole}</span>
                  {" · "}{analysis.experienceLevel}{" · "}{analysis.keywords.slice(0, 4).join(", ")}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-background rounded-lg p-3 border border-border">
                      <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Inferred Role</p>
                      <p className="text-sm font-semibold text-foreground">{analysis.inferredRole}</p>
                    </div>
                    <div className="bg-background rounded-lg p-3 border border-border">
                      <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Experience Level</p>
                      <p className="text-sm font-semibold text-foreground">{analysis.experienceLevel} · {analysis.yearsEstimate}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Top Keywords Found</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.keywords.map((kw) => (
                        <span key={kw} className="bg-blue-500/10 text-blue-400 text-xs px-2.5 py-1 rounded-full border border-blue-500/20">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {analysis.industries.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Target Industries</p>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.industries.map((ind) => (
                          <span key={ind} className="bg-purple-500/10 text-purple-400 text-xs px-2.5 py-1 rounded-full border border-purple-500/20">
                            {ind}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-accent/5 border border-accent/20 rounded-lg px-4 py-3">
                    <p className="text-[10px] text-accent uppercase tracking-wider mb-1">AI Profile Summary</p>
                    <p className="text-sm text-foreground italic">&ldquo;{analysis.summary}&rdquo;</p>
                  </div>

                  <div className="bg-background rounded-lg p-3 border border-border">
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-1">LinkedIn Search Query</p>
                    <p className="text-sm font-mono text-foreground">{analysis.searchQuery}</p>
                  </div>

                  <button
                    onClick={runSearch}
                    disabled={loading}
                    className="mt-2 px-5 py-2.5 bg-accent text-background rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                  >
                    Search for Best Job Match →
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: JOB SEARCH ── */}
      {(phase === "step2" || currentStep > 1) && (
        <div className={`bg-card border rounded-xl p-6 mb-4 ${currentStep > 1 && phase !== "step2" ? "border-border opacity-80" : "border-accent/30"}`}>
          <div className="flex items-center gap-2 mb-4">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${currentStep > 1 ? "bg-accent text-background" : "border-2 border-accent text-accent"}`}>
              {currentStep > 1 ? "✓" : "2"}
            </span>
            <h3 className="font-semibold">Job Search</h3>
          </div>

          {phase === "step2" && loading && <StepLoader label="Searching LinkedIn for your best match…" />}

          {job && (
            phase !== "step2" ? (
              <p className="text-sm text-muted">
                Found: <span className="text-foreground font-medium">{job.title}</span> at <span className="text-foreground">{job.company}</span>
              </p>
            ) : (
              <div className="space-y-3">
                <div className="bg-background border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{job.title}</h4>
                      <p className="text-xs text-muted mt-0.5">{job.company} · {job.location}</p>
                      {job.salary && <p className="text-xs text-accent mt-0.5">{job.salary}</p>}
                      {job.postedAt && <p className="text-xs text-muted mt-0.5">Posted: {job.postedAt}</p>}
                    </div>
                    {job.url && (
                      <a href={job.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-accent border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/10 transition-colors shrink-0">
                        View Posting ↗
                      </a>
                    )}
                  </div>
                  {job.description && (
                    <p className="text-xs text-muted mt-3 line-clamp-3 leading-relaxed">{job.description}</p>
                  )}
                </div>
                <p className="text-xs text-muted italic">Analyzing match quality automatically…</p>
              </div>
            )
          )}
        </div>
      )}

      {/* ── STEP 3: MATCH ANALYSIS ── */}
      {(phase === "step3" || currentStep > 2) && (
        <div className={`bg-card border rounded-xl p-6 mb-4 ${currentStep > 2 && phase !== "step3" ? "border-border opacity-80" : "border-accent/30"}`}>
          <div className="flex items-center gap-2 mb-4">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${currentStep > 2 ? "bg-accent text-background" : "border-2 border-accent text-accent"}`}>
              {currentStep > 2 ? "✓" : "3"}
            </span>
            <h3 className="font-semibold">Match Analysis</h3>
          </div>

          {phase === "step3" && loading && <StepLoader label="Comparing job requirements to your resume…" />}

          {match && (
            phase !== "step3" ? (
              <p className="text-sm text-muted">
                Score: <span className={`font-semibold ${match.score >= 0.7 ? "text-green-400" : match.score >= 0.4 ? "text-yellow-400" : "text-red-400"}`}>
                  {Math.round(match.score * 100)}%
                </span>
                {" — "}{match.analysis.summary}
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <ScoreBadge score={match.score} />
                  <div>
                    <p className="text-sm text-foreground font-medium">{match.analysis.summary}</p>
                    <p className="text-xs text-muted mt-0.5">{match.isRelevant ? "✓ Relevant match" : "⚠ Borderline match"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {match.analysis.matchedSkills.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Matched Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {match.analysis.matchedSkills.map((s) => (
                          <span key={s} className="bg-green-500/10 text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-500/20">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {match.analysis.missingSkills.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Gaps / Missing</p>
                      <div className="flex flex-wrap gap-1.5">
                        {match.analysis.missingSkills.map((s) => (
                          <span key={s} className="bg-red-500/10 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-500/20">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {match.analysis.highlights.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Key Observations</p>
                    <ul className="space-y-1.5">
                      {match.analysis.highlights.map((h, i) => (
                        <li key={i} className="text-xs text-muted flex gap-2">
                          <span className="text-accent shrink-0">→</span>{h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={runTailor}
                  disabled={loading}
                  className="mt-2 px-5 py-2.5 bg-accent text-background rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  Tailor Resume for This Job →
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* ── STEP 4: RESUME TAILORING ── */}
      {(phase === "step4" || currentStep > 3) && (
        <div className={`bg-card border rounded-xl p-6 mb-4 ${currentStep > 3 && phase !== "step4" ? "border-border opacity-80" : "border-accent/30"}`}>
          <div className="flex items-center gap-2 mb-4">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${currentStep > 3 ? "bg-accent text-background" : "border-2 border-accent text-accent"}`}>
              {currentStep > 3 ? "✓" : "4"}
            </span>
            <h3 className="font-semibold">Resume Tailoring</h3>
          </div>

          {phase === "step4" && loading && <StepLoader label="Tailoring your resume and drafting cover letter…" />}

          {tailor && (
            phase !== "step4" ? (
              <p className="text-sm text-muted">Resume tailored. Cover letter ready.</p>
            ) : (
              <div className="space-y-4">
                {/* Side-by-side panels */}
                {tailor.original && tailor.tailored ? (
                  <>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className="inline-block w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500/30" />
                      yellow highlight = AI-reworded for this job
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <p className="text-[10px] text-muted uppercase tracking-wider mb-2 text-center">Your Original Resume</p>
                        <div className="border border-border rounded-lg p-3 max-h-[480px] overflow-y-auto bg-background">
                          <StructuredResumePanel resume={tailor.original} />
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-accent uppercase tracking-wider mb-2 text-center font-medium">Tailored for This Job</p>
                        <div className="border border-accent/20 rounded-lg p-3 max-h-[480px] overflow-y-auto bg-background">
                          <StructuredResumePanel
                            resume={tailor.tailored}
                            compare={tailor.original}
                            highlight
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-background border border-border rounded-lg p-4 max-h-80 overflow-y-auto">
                    <p className="text-xs text-muted whitespace-pre-wrap">{tailor.tailoredRaw}</p>
                  </div>
                )}

                {/* Cover letter collapsible */}
                {tailor.coverLetter && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setCoverOpen((v) => !v)}
                      className="w-full flex justify-between items-center px-4 py-3 text-sm font-medium hover:bg-card-hover transition-colors"
                    >
                      <span>Cover Letter</span>
                      <span className="text-muted">{coverOpen ? "▲" : "▼"}</span>
                    </button>
                    {coverOpen && (
                      <div className="px-4 pb-4 border-t border-border">
                        <pre className="text-xs text-muted whitespace-pre-wrap leading-relaxed font-mono mt-3">
                          {tailor.coverLetter}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setPhase("step5")}
                  className="mt-2 px-5 py-2.5 bg-accent text-background rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
                >
                  Review & Save Application →
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* ── STEP 5: APPLY ── */}
      {phase === "step5" && job && tailor && (
        <div className="bg-card border border-accent/30 rounded-xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 border-accent text-accent">5</span>
            <h3 className="font-semibold">Apply</h3>
          </div>

          <div className="space-y-4">
            <div className="bg-background border border-border rounded-lg p-4">
              <h4 className="text-sm font-semibold text-foreground">{job.title}</h4>
              <p className="text-xs text-muted mt-0.5">{job.company} · {job.location}</p>
            </div>

            {/* Honest explanation of what "apply" means here */}
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-yellow-400">How applying works</p>
              <p className="text-xs text-muted leading-relaxed">
                JobPilot <span className="text-foreground font-medium">does not automatically submit your application to LinkedIn</span> — LinkedIn does not allow automated form submissions without your session. Instead, applying here means:
              </p>
              <ol className="text-xs text-muted space-y-1 list-none">
                {[
                  "Your tailored resume + cover letter are saved to your tracker",
                  "You click \"Open LinkedIn\" to go directly to the job posting",
                  "You apply there manually using Easy Apply (takes ~60 seconds with your tailored resume ready)",
                  "Come back and mark the status as \"Applied\"",
                ].map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-accent font-bold shrink-0">{i + 1}.</span>{step}
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={runApply}
                disabled={loading}
                className="px-6 py-2.5 bg-accent text-background rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {loading ? "Saving…" : "Save to Tracker"}
              </button>
              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2.5 border border-accent/40 text-accent rounded-lg text-sm font-medium hover:bg-accent/10 transition-colors"
                >
                  Open LinkedIn ↗
                </a>
              )}
              <Link
                href="/applications"
                className="px-6 py-2.5 border border-border text-muted rounded-lg text-sm hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                Skip
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {phase === "done" && (
        <div className="bg-card border border-green-500/30 rounded-xl p-8 space-y-4">
          <div className="text-center space-y-2">
            <div className="text-3xl">✓</div>
            <h2 className="text-lg font-bold text-green-400">Saved to Tracker!</h2>
            <p className="text-sm text-muted">Your tailored resume and cover letter are ready.</p>
          </div>

          {job?.url && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-accent">Next step: Apply on LinkedIn</p>
              <p className="text-xs text-muted">Open the job posting, click Easy Apply, and upload your tailored resume. Then come back and mark it as Applied.</p>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-accent underline hover:text-accent/80"
              >
                Open {job.company} job posting ↗
              </a>
            </div>
          )}

          <div className="flex gap-3 justify-center pt-2">
            <Link
              href="/applications"
              className="px-5 py-2.5 bg-accent text-background rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              View in Applications →
            </Link>
            <button
              onClick={() => {
                setPhase("welcome");
                setAnalysis(null); setJob(null); setMatch(null); setTailor(null);
                setApplicationId(null); setError("");
              }}
              className="px-5 py-2.5 border border-border text-muted rounded-lg text-sm hover:text-foreground transition-colors"
            >
              Run Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
