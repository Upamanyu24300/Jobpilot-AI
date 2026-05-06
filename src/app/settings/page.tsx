"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    name: "",
    email: "",
    groqApiKey: "",
    preferredRoles: "",
    preferredLocations: "",
  });
  const [expYears, setExpYears] = useState(0);
  const [expMonths, setExpMonths] = useState(0);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apifyTokenInput, setApifyTokenInput] = useState("");
  const [hasApifyToken, setHasApifyToken] = useState(false);
  const [hasResume, setHasResume] = useState(false);
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          name: data.name || "",
          email: data.email || "",
          groqApiKey: "",
          preferredRoles: data.preferredRoles || "",
          preferredLocations: data.preferredLocations || "",
        });
        const totalMonths = data.experienceMonths || 0;
        setExpYears(Math.floor(totalMonths / 12));
        setExpMonths(totalMonths % 12);
        setHasApiKey(data.hasApiKey);
        setHasApifyToken(data.hasApifyToken);
        setHasResume(data.hasResume);
        setResumeFileName(data.resumeFileName || "");
        setResumeUrl(data.resumeUrl || "");
      });
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    setMessage("");
    const payload: Record<string, unknown> = { ...settings, experienceMonths: expYears * 12 + expMonths };
    if (apiKeyInput) payload.groqApiKey = apiKeyInput;
    if (!apiKeyInput) delete payload.groqApiKey;
    if (apifyTokenInput) payload.apifyToken = apifyTokenInput;
    if (!apifyTokenInput) delete payload.apifyToken;

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      setMessage("Settings saved!");
      if (apiKeyInput) {
        setHasApiKey(true);
        setApiKeyInput("");
      }
      if (apifyTokenInput) {
        setHasApifyToken(true);
        setApifyTokenInput("");
      }
    }
    setSaving(false);
  };

  const uploadResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage("");
    const formData = new FormData();
    formData.append("resume", file);

    const res = await fetch("/api/resume/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.success) {
      setHasResume(true);
      setResumeFileName(data.fileName);
      if (data.resumeUrl) setResumeUrl(data.resumeUrl);
      setMessage(`Resume uploaded! Extracted ${data.textLength} characters.`);
    } else {
      setMessage(data.error || "Upload failed");
    }
    setUploading(false);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-muted text-sm mb-6">Configure your profile and API keys</p>

      {message && (
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 mb-6 text-sm text-accent">
          {message}
        </div>
      )}

      {/* Profile */}
      <section className="bg-card border border-border rounded-lg p-5 mb-4">
        <h2 className="font-semibold text-sm mb-4">Profile</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted block mb-1.5">Name</label>
            <input
              type="text"
              value={settings.name}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1.5">Email</label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="your@email.com"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-xs text-muted block mb-1.5">Preferred Roles (comma-separated)</label>
            <input
              type="text"
              value={settings.preferredRoles}
              onChange={(e) => setSettings({ ...settings, preferredRoles: e.target.value })}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="e.g., Frontend Developer, React Engineer"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1.5">Preferred Locations</label>
            <input
              type="text"
              value={settings.preferredLocations}
              onChange={(e) =>
                setSettings({ ...settings, preferredLocations: e.target.value })
              }
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              placeholder="e.g., Remote, New York, London"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="text-xs text-muted block mb-1.5">Total Experience</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={expYears}
              onChange={(e) => setExpYears(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-20 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-center"
              min={0}
            />
            <span className="text-sm text-muted">yr</span>
            <input
              type="number"
              value={expMonths}
              onChange={(e) => setExpMonths(Math.min(11, Math.max(0, parseInt(e.target.value) || 0)))}
              className="w-20 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-center"
              min={0}
              max={11}
            />
            <span className="text-sm text-muted">mo</span>
            {(expYears > 0 || expMonths > 0) && (
              <span className="text-xs text-muted ml-1">
                = {expYears * 12 + expMonths} months total
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted mt-1">Used as a hard filter — jobs requiring significantly more experience are excluded.</p>
        </div>
      </section>

      {/* API Key */}
      <section className="bg-card border border-border rounded-lg p-5 mb-4">
        <h2 className="font-semibold text-sm mb-1">Groq API Key</h2>
        <p className="text-xs text-muted mb-4">
          Get a free key at{" "}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline"
          >
            console.groq.com/keys
          </a>
        </p>
        {hasApiKey && (
          <p className="text-xs text-success mb-2">API key is set. Enter a new one to replace it.</p>
        )}
        <input
          type="password"
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          placeholder="gsk_..."
        />
      </section>

      {/* Apify Token */}
      <section className="bg-card border border-border rounded-lg p-5 mb-4">
        <h2 className="font-semibold text-sm mb-1">Apify Token</h2>
        <p className="text-xs text-muted mb-4">
          Used to scrape LinkedIn jobs reliably. Get a free token at{" "}
          <a
            href="https://console.apify.com/settings/integrations"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline"
          >
            console.apify.com
          </a>
          . The free tier ($5/month credit) is more than enough for personal use.
        </p>
        {hasApifyToken && (
          <p className="text-xs text-success mb-2">Apify token is set. Enter a new one to replace it.</p>
        )}
        <input
          type="password"
          value={apifyTokenInput}
          onChange={(e) => setApifyTokenInput(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          placeholder="apify_api_..."
        />
      </section>

      {/* Resume Upload */}
      <section className="bg-card border border-border rounded-lg p-5 mb-4">
        <h2 className="font-semibold text-sm mb-1">Resume</h2>
        <p className="text-xs text-muted mb-4">Upload your resume as PDF. It will be parsed and used for job matching.</p>
        {hasResume && (
          <p className="text-xs text-success mb-2">
            Current: {resumeFileName}
            {resumeUrl && (
              <a
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-3 text-accent underline"
              >
                Download
              </a>
            )}
          </p>
        )}
        <label className="inline-flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg cursor-pointer hover:border-accent transition-colors text-sm">
          {uploading ? "Uploading..." : "Choose PDF"}
          <input
            type="file"
            accept=".pdf"
            onChange={uploadResume}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </section>

      <button
        onClick={saveSettings}
        disabled={saving}
        className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
