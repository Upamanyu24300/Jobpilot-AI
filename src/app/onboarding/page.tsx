"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const TOTAL_STEPS = 4;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
              i < current
                ? "bg-accent text-white"
                : i === current
                  ? "bg-accent text-white ring-2 ring-accent/30"
                  : "bg-card border border-border text-muted"
            }`}
          >
            {i < current ? "✓" : i + 1}
          </div>
          {i < TOTAL_STEPS - 1 && (
            <div className={`h-px w-8 ${i < current ? "bg-accent" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function HowToBox({ steps }: { steps: string[] }) {
  return (
    <div className="bg-background border border-border rounded-lg p-4 mb-5">
      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">How to get it</p>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent text-xs flex items-center justify-center font-semibold mt-0.5">
              {i + 1}
            </span>
            <span className="text-muted leading-snug" dangerouslySetInnerHTML={{ __html: s }} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function WhyBox({ text }: { text: string }) {
  return (
    <div className="bg-accent/5 border border-accent/15 rounded-lg p-4 mb-5">
      <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-1">Why you need this</p>
      <p className="text-sm text-muted leading-relaxed">{text}</p>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(-1); // -1 = welcome
  const [groqKey, setGroqKey] = useState("");
  const [apifyToken, setApifyToken] = useState("");
  const [profile, setProfile] = useState({ preferredRoles: "", preferredLocations: "" });
  const [expYears, setExpYears] = useState(0);
  const [expMonths, setExpMonths] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // If already fully set up, skip to dashboard
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.hasGroqKey && data.hasApifyToken && data.hasResume) {
          router.replace("/");
        }
      });
  }, [router]);

  const saveAndNext = async () => {
    setError("");
    setSaving(true);

    try {
      if (step === 0) {
        // Groq API key
        if (!groqKey.trim()) { setError("Please enter your Groq API key."); setSaving(false); return; }
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groqApiKey: groqKey.trim() }),
        });
        if (!res.ok) throw new Error("Failed to save");
      }

      if (step === 1) {
        // Apify token
        if (!apifyToken.trim()) { setError("Please enter your Apify token."); setSaving(false); return; }
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apifyToken: apifyToken.trim() }),
        });
        if (!res.ok) throw new Error("Failed to save");
      }

      if (step === 2) {
        // Resume — handled inline in uploadResume()
        if (!resumeUploaded) { setError("Please upload your resume to continue."); setSaving(false); return; }
      }

      if (step === 3) {
        // Profile — optional, just save whatever is filled
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...profile, experienceMonths: expYears * 12 + expMonths }),
        });
        router.replace("/");
        return;
      }

      setStep((s) => s + 1);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const uploadResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setSaving(true);
    const formData = new FormData();
    formData.append("resume", file);
    try {
      const res = await fetch("/api/resume/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setResumeUploaded(true);
      } else {
        setError(data.error || "Upload failed");
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Welcome screen ──────────────────────────────────────────
  if (step === -1) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center">
          <h1 className="text-3xl font-bold mb-2">
            Welcome to <span className="text-accent">JobPilot AI</span>
          </h1>
          <p className="text-muted mb-8 leading-relaxed">
            Your personal job-hunting assistant. It scrapes LinkedIn, scores jobs against your resume using AI,
            and auto-tailors a resume + cover letter for every relevant listing — so you only deal with the jobs worth applying to.
          </p>

          <div className="grid grid-cols-3 gap-4 mb-10">
            {[
              { icon: "⊙", label: "Scrape LinkedIn", desc: "Finds fresh listings on autopilot" },
              { icon: "◎", label: "AI Scoring", desc: "Ranks jobs by how well they match you" },
              { icon: "✦", label: "Auto-Tailor", desc: "Rewrites your resume for each job" },
            ].map((f) => (
              <div key={f.label} className="bg-card border border-border rounded-lg p-4">
                <div className="text-2xl mb-2">{f.icon}</div>
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-xs text-muted mt-1">{f.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted mb-6">Takes about 3 minutes to set up. You&apos;ll need:</p>
          <div className="flex justify-center gap-6 text-sm text-muted mb-8">
            <span>· A free Groq account</span>
            <span>· A free Apify account</span>
            <span>· Your resume PDF</span>
          </div>

          <button
            onClick={() => setStep(0)}
            className="px-8 py-3 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors"
          >
            Get Started →
          </button>
        </div>
      </div>
    );
  }

  // ── Step screens ────────────────────────────────────────────
  const stepContent = [
    // Step 0 — Groq
    {
      title: "Connect AI (Groq)",
      subtitle: "Groq powers the intelligence behind JobPilot.",
      why: "JobPilot uses Groq's free AI to score every job against your resume, rewrite your resume to highlight the right skills for each role, and generate cover letters. Without this, none of the AI features work.",
      how: [
        'Go to <a href="https://console.groq.com/keys" target="_blank" class="text-accent underline">console.groq.com/keys</a> and sign up (free)',
        'Click <strong class="text-foreground">"Create API Key"</strong> and give it any name',
        'Copy the key — it starts with <code class="bg-card px-1.5 py-0.5 rounded text-accent">gsk_</code>',
        "Paste it below",
      ],
      input: (
        <input
          type="password"
          value={groqKey}
          onChange={(e) => setGroqKey(e.target.value)}
          placeholder="gsk_..."
          className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
        />
      ),
      ctaLabel: "Save & Continue",
    },
    // Step 1 — Apify
    {
      title: "Connect Job Scraper (Apify)",
      subtitle: "Apify reliably fetches LinkedIn job listings.",
      why: "JobPilot searches LinkedIn for you automatically. Apify handles the scraping reliably — it manages proxies and anti-bot measures so listings actually come through. Without it, job search returns nothing.",
      how: [
        'Go to <a href="https://apify.com" target="_blank" class="text-accent underline">apify.com</a> and sign up (free — $5/mo credit included)',
        'In the dashboard, click your avatar → <strong class="text-foreground">Settings → Integrations</strong>',
        'Copy your <strong class="text-foreground">Personal API token</strong> — it starts with <code class="bg-card px-1.5 py-0.5 rounded text-accent">apify_api_</code>',
        "Paste it below",
      ],
      input: (
        <input
          type="password"
          value={apifyToken}
          onChange={(e) => setApifyToken(e.target.value)}
          placeholder="apify_api_..."
          className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
        />
      ),
      ctaLabel: "Save & Continue",
    },
    // Step 2 — Resume
    {
      title: "Upload Your Resume",
      subtitle: "The foundation of every tailored application.",
      why: "Your resume is used for two things: checking whether a job is relevant to your background, and generating a tailored version that emphasises the right skills for each role. Keep it up to date — the better it is, the better the AI output.",
      how: [
        "Make sure your resume is saved as a <strong class=\"text-foreground\">PDF</strong>",
        'Click <strong class="text-foreground">"Choose PDF"</strong> below and select your file',
        "Text is extracted automatically — nothing is stored as a raw file visible to others",
      ],
      input: (
        <div>
          {resumeUploaded ? (
            <div className="flex items-center gap-3 p-3 bg-accent/10 border border-accent/20 rounded-lg">
              <span className="text-accent text-lg">✓</span>
              <div>
                <p className="text-sm font-medium text-accent">Resume uploaded successfully</p>
                <p className="text-xs text-muted">Click below to replace it</p>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent transition-colors">
              <span className="text-3xl">📄</span>
              <div className="text-center">
                <p className="text-sm font-medium">{saving ? "Uploading..." : "Choose your resume PDF"}</p>
                <p className="text-xs text-muted mt-1">PDF files only</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                onChange={uploadResume}
                className="hidden"
                disabled={saving}
              />
            </label>
          )}
        </div>
      ),
      ctaLabel: resumeUploaded ? "Continue" : "Upload to Continue",
    },
    // Step 3 — Profile
    {
      title: "Set Your Preferences",
      subtitle: "Optional — helps the AI find better matches.",
      why: "Preferred roles and locations are used as search defaults so you don't have to retype them every time. Years of experience gives the AI context when tailoring your resume.",
      how: [
        'Enter job titles you\'re targeting, comma-separated (e.g. <em class="text-foreground">Frontend Developer, React Engineer</em>)',
        'Enter locations you\'d consider (e.g. <em class="text-foreground">Remote, London, Berlin</em>)',
        "You can always update these in Settings later",
      ],
      input: (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted block mb-1.5">Preferred Roles</label>
            <input
              type="text"
              value={profile.preferredRoles}
              onChange={(e) => setProfile({ ...profile, preferredRoles: e.target.value })}
              placeholder="e.g. Frontend Developer, React Engineer"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1.5">Preferred Locations</label>
            <input
              type="text"
              value={profile.preferredLocations}
              onChange={(e) => setProfile({ ...profile, preferredLocations: e.target.value })}
              placeholder="e.g. Remote, London, Berlin"
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1.5">Total Experience</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={expYears}
                onChange={(e) => setExpYears(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent text-center"
              />
              <span className="text-sm text-muted">yr</span>
              <input
                type="number"
                min={0}
                max={11}
                value={expMonths}
                onChange={(e) => setExpMonths(Math.min(11, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-16 bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent text-center"
              />
              <span className="text-sm text-muted">mo</span>
            </div>
          </div>
        </div>
      ),
      ctaLabel: "Save & Finish",
    },
  ];

  const current = stepContent[step];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="mb-6">
          <h1 className="text-lg font-bold">
            <span className="text-accent">Job</span>Pilot AI
          </h1>
        </div>

        <StepIndicator current={step} />

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-xl font-bold mb-1">{current.title}</h2>
          <p className="text-sm text-muted mb-6">{current.subtitle}</p>

          <WhyBox text={current.why} />
          <HowToBox steps={current.how} />

          <div className="mb-4">{current.input}</div>

          {error && (
            <p className="text-xs text-red-400 mb-3">{error}</p>
          )}

          <div className="flex items-center justify-between mt-2">
            {step === 3 ? (
              <button
                onClick={() => router.replace("/")}
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                Skip for now
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={saveAndNext}
              disabled={saving}
              className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : current.ctaLabel}
            </button>
          </div>
        </div>

        <p className="text-xs text-muted text-center mt-4">
          Step {step + 1} of {TOTAL_STEPS}
        </p>
      </div>
    </div>
  );
}
