"use client";

import { useEffect, useState } from "react";

interface AutomationConfig {
  id: string;
  isActive: boolean;
  searchQuery: string;
  location: string;
  cronExpression: string;
  autoTailor: boolean;
  maxRelevantJobs: number;
  lastRun: string | null;
}

const cronPresets = [
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Daily at 9 AM", value: "0 9 * * *" },
  { label: "Twice daily (9 AM & 6 PM)", value: "0 9,18 * * *" },
  { label: "Every weekday at 9 AM", value: "0 9 * * 1-5" },
  { label: "Weekly (Monday 9 AM)", value: "0 9 * * 1" },
];

export default function AutomationPage() {
  const [configs, setConfigs] = useState<AutomationConfig[]>([]);
  const [newQuery, setNewQuery] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newCron, setNewCron] = useState("0 9 * * *");
  const [autoTailor, setAutoTailor] = useState(true);
  const [maxK, setMaxK] = useState(-1);
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState<string | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    const res = await fetch("/api/automation");
    const data = await res.json();
    setConfigs(data.configs || []);
  };

  const createConfig = async () => {
    if (!newQuery) return;
    const res = await fetch("/api/automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        searchQuery: newQuery,
        location: newLocation,
        cronExpression: newCron,
        autoTailor,
        maxRelevantJobs: maxK,
      }),
    });
    const data = await res.json();
    if (data.config) {
      setConfigs((prev) => [data.config, ...prev]);
      setNewQuery("");
      setNewLocation("");
      setMessage("Automation created!");
    }
  };

  const toggleConfig = async (id: string, isActive: boolean) => {
    await fetch("/api/automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id, isActive }),
    });
    setConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isActive } : c))
    );
  };

  const deleteConfig = async (id: string) => {
    await fetch("/api/automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    setConfigs((prev) => prev.filter((c) => c.id !== id));
  };

  const runNow = async (id: string) => {
    setRunning(id);
    setMessage("Running automation... This may take a minute.");
    try {
      const res = await fetch("/api/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", id }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage(data.error);
      } else {
        setMessage(
          `Done! Found ${data.jobsFound} jobs, ${data.newJobs} new, ${data.relevantJobs} relevant, ${data.tailored} tailored.`
        );
        loadConfigs();
      }
    } catch {
      setMessage("Automation run failed.");
    }
    setRunning(null);
  };

  const formatK = (k: number) => (k === -1 ? "All" : String(k));

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Automation</h1>
      <p className="text-muted text-sm mb-6">
        Set up scheduled job searches that auto-find, check, and tailor
      </p>

      {message && (
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 mb-4 text-sm text-accent">
          {message}
        </div>
      )}

      {/* Create New */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        <h2 className="font-semibold text-sm mb-4">New Automation</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            value={newQuery}
            onChange={(e) => setNewQuery(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            placeholder="Job search query"
          />
          <input
            type="text"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            placeholder="Location (optional)"
          />
        </div>
        <div className="flex gap-3 mb-3 items-center flex-wrap">
          <select
            value={newCron}
            onChange={(e) => setNewCron(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          >
            {cronPresets.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={autoTailor}
              onChange={(e) => setAutoTailor(e.target.checked)}
              className="rounded"
            />
            Auto-tailor resumes
          </label>
        </div>

        {/* Threshold K */}
        <div className="flex items-center gap-3 mb-4">
          <label className="text-xs text-muted whitespace-nowrap">
            Max jobs to tailor per run (k):
          </label>
          <input
            type="number"
            value={maxK}
            onChange={(e) => setMaxK(parseInt(e.target.value) || -1)}
            className="w-20 bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
            min={-1}
          />
          <span className="text-xs text-muted">
            -1 = all relevant jobs
          </span>
        </div>

        <button
          onClick={createConfig}
          disabled={!newQuery}
          className="px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          Create Automation
        </button>
      </div>

      {/* Existing Configs */}
      {configs.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-muted text-sm">
          No automations set up yet. Create one above.
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((config) => (
            <div
              key={config.id}
              className="bg-card border border-border rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">
                    {config.searchQuery}
                    {config.location && (
                      <span className="text-muted font-normal">
                        {" "}
                        in {config.location}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-muted mt-1">
                    {cronPresets.find((p) => p.value === config.cronExpression)
                      ?.label || config.cronExpression}
                    {config.autoTailor && " · Auto-tailor ON"}
                    {" · k="}{formatK(config.maxRelevantJobs)}
                    {config.lastRun &&
                      ` · Last: ${new Date(config.lastRun).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runNow(config.id)}
                    disabled={running === config.id}
                    className="text-xs px-3 py-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors disabled:opacity-50"
                  >
                    {running === config.id ? "Running..." : "Run Now"}
                  </button>
                  <button
                    onClick={() =>
                      toggleConfig(config.id, !config.isActive)
                    }
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      config.isActive
                        ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                        : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    }`}
                  >
                    {config.isActive ? "Active" : "Paused"}
                  </button>
                  <button
                    onClick={() => deleteConfig(config.id)}
                    className="text-xs px-2 py-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 bg-card border border-border rounded-lg p-4">
        <p className="text-xs text-muted">
          <strong>Tip:</strong> Use the{" "}
          <a href="/jobs" className="text-accent underline">
            Job Search
          </a>{" "}
          page for one-off manual runs with the &quot;Do It Now&quot; button.
          Automations here are for recurring scheduled searches.
          For Vercel deployment, use Vercel Cron Jobs (free tier: 2 cron jobs).
        </p>
      </div>
    </div>
  );
}
