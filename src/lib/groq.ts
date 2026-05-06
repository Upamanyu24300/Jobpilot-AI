import Groq from "groq-sdk";

const PRIMARY_MODEL = "llama-3.3-70b-versatile";
const FALLBACK_MODEL = "gpt-120b-oss";

export function createGroqClient(apiKey: string) {
  return new Groq({ apiKey });
}

interface CompletionParams {
  messages: Groq.Chat.Completions.ChatCompletionMessageParam[];
  temperature?: number;
  max_tokens?: number;
}

async function callWithFallback(
  groq: Groq,
  params: CompletionParams
): Promise<Groq.Chat.Completions.ChatCompletion> {
  try {
    return await groq.chat.completions.create({ ...params, model: PRIMARY_MODEL }) as Groq.Chat.Completions.ChatCompletion;
  } catch (primaryErr) {
    const hint = primaryErr instanceof Error ? primaryErr.message.slice(0, 120) : String(primaryErr);
    console.warn(`[groq] ${PRIMARY_MODEL} failed (${hint}), retrying with ${FALLBACK_MODEL}`);
    try {
      return await groq.chat.completions.create({ ...params, model: FALLBACK_MODEL }) as Groq.Chat.Completions.ChatCompletion;
    } catch (fallbackErr) {
      console.error(`[groq] ${FALLBACK_MODEL} also failed:`, fallbackErr);
      throw primaryErr;
    }
  }
}

export interface RelevanceAnalysis {
  summary: string;
  matchedSkills: string[];
  missingSkills: string[];
  highlights: string[];
}

// Structured resume format — used for tailored output and PDF rendering
export interface ResumeSkill {
  category: string;
  items: string;
}

export interface ResumeEntry {
  left: string;       // main heading (company / degree / project name)
  right: string;      // date
  sub1?: string;      // subtitle line 1 (job title / institution)
  sub2?: string;      // subtitle line 2 (location / GPA)
  detail?: string;    // extra detail (specialization, award info, etc.)
  bullets: string[];
}

export interface ResumeSection {
  title: string;
  entries: ResumeEntry[];
}

export interface StructuredResume {
  name: string;
  contact: string;    // single line: "phone — email — linkedin — github"
  summary: string;
  skills: ResumeSkill[];
  sections: ResumeSection[];
}

export interface ResumeAnalysis {
  inferredRole: string;
  experienceLevel: string;
  yearsEstimate: string;
  keywords: string[];
  industries: string[];
  searchQuery: string;
  summary: string;
}

export async function analyzeResume(
  apiKey: string,
  resumeText: string
): Promise<ResumeAnalysis> {
  const groq = createGroqClient(apiKey);

  const response = await callWithFallback(groq, {
    messages: [
      {
        role: "system",
        content: `Analyze the resume and extract key profile information.

Respond ONLY with valid JSON in this exact format:
{
  "inferredRole": "Primary job title the candidate is targeting (e.g. 'Backend Software Engineer')",
  "experienceLevel": "Entry-level / Mid-level / Senior / Lead — pick the most fitting",
  "yearsEstimate": "Estimated years of experience (e.g. '1–2 years' or '3–5 years')",
  "keywords": ["top", "technical", "skill", "keywords", "max8"],
  "industries": ["industry1", "industry2"],
  "searchQuery": "Optimal LinkedIn job search query string for this candidate (e.g. 'Backend Engineer Python Django')",
  "summary": "One concise sentence describing the candidate's professional profile"
}

keywords: pick up to 8 specific technologies, tools, frameworks, or skills that appear in the resume.
industries: infer 1–3 industries the candidate fits based on their experience.
searchQuery: craft the best LinkedIn search string to find suitable jobs for this person.`,
      },
      { role: "user", content: resumeText.slice(0, 8000) },
    ],
    temperature: 0,
    max_tokens: 400,
  });

  const text = response.choices[0]?.message?.content || "";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        inferredRole: parsed.inferredRole || "Software Engineer",
        experienceLevel: parsed.experienceLevel || "Mid-level",
        yearsEstimate: parsed.yearsEstimate || "2–4 years",
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 8) : [],
        industries: Array.isArray(parsed.industries) ? parsed.industries : [],
        searchQuery: parsed.searchQuery || parsed.inferredRole || "Software Engineer",
        summary: parsed.summary || "",
      };
    }
  } catch {
    // fall through
  }
  return {
    inferredRole: "Software Engineer",
    experienceLevel: "Mid-level",
    yearsEstimate: "2–4 years",
    keywords: [],
    industries: [],
    searchQuery: "Software Engineer",
    summary: "Could not parse resume analysis.",
  };
}

export async function checkJobRelevance(
  apiKey: string,
  resumeText: string,
  jobTitle: string,
  jobDescription: string,
  jobCompany: string,
  userExperienceMonths = 0
): Promise<{ isRelevant: boolean; score: number; reason: string }> {
  const groq = createGroqClient(apiKey);

  const userYears = userExperienceMonths > 0 ? (userExperienceMonths / 12).toFixed(1) : null;
  const experienceContext = userYears
    ? `Candidate has ${userYears} years (${userExperienceMonths} months) of total experience.`
    : "";
  const experienceRule = userYears
    ? `HARD RULE — Experience: If the job explicitly states a minimum years of experience (e.g. "3+ years", "minimum 5 years", "at least X years") AND that requirement exceeds the candidate's experience by more than 2 years, you MUST set isRelevant to false, regardless of skills match. Do NOT apply this rule if the job has no explicit experience requirement.`
    : "";

  const response = await callWithFallback(groq, {
    messages: [
      {
        role: "system",
        content: `You are a job relevance analyzer. Given a candidate's resume and a job posting, produce a detailed match analysis.
${experienceContext ? `\n${experienceContext}` : ""}${experienceRule ? `\n${experienceRule}` : ""}

Respond ONLY with valid JSON in this exact format:
{
  "isRelevant": true/false,
  "score": 0.0-1.0,
  "summary": "one sentence verdict",
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill1", "skill2"],
  "highlights": ["key point 1", "key point 2", "key point 3"]
}

Score guidelines:
- 0.8-1.0: Excellent match - candidate has most required skills and experience level
- 0.6-0.8: Good match - candidate has many relevant skills with minor gaps
- 0.4-0.6: Partial match - some skills overlap but notable gaps exist
- 0.0-0.4: Poor match - few relevant skills or experience level mismatch

matchedSkills: specific technologies/skills from the job that appear in the resume (max 8)
missingSkills: important requirements from the job NOT in the resume (max 5)
highlights: 2-4 specific reasons why this is or isn't a good fit (concrete, not generic)`,
      },
      {
        role: "user",
        content: `RESUME:\n${resumeText.slice(0, 8000)}\n\nJOB TITLE: ${jobTitle}\nCOMPANY: ${jobCompany}\nJOB DESCRIPTION:\n${jobDescription.slice(0, 3000)}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 600,
  });

  const text = response.choices[0]?.message?.content || "";
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const analysis: RelevanceAnalysis = {
        summary: parsed.summary || parsed.reason || "",
        matchedSkills: Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills : [],
        missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : [],
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      };
      return {
        isRelevant: Boolean(parsed.isRelevant),
        score: Number(parsed.score) || 0,
        reason: JSON.stringify(analysis),
      };
    }
  } catch {
    // fall through
  }
  return {
    isRelevant: false,
    score: 0,
    reason: JSON.stringify({ summary: "Failed to parse AI response", matchedSkills: [], missingSkills: [], highlights: [] }),
  };
}

// Step 1 of tailoring: parse plain text into structured JSON (preserves design intent)
export async function parseResumeToStructure(groq: Groq, resumeText: string): Promise<StructuredResume | null> {
  const response = await callWithFallback(groq, {
    messages: [
      {
        role: "system",
        content: `Extract the resume into structured JSON. Copy all content exactly as written — do NOT modify, summarise, or reorder anything.

Return ONLY valid JSON in this exact schema:
{
  "name": "Full Name",
  "contact": "all contact details on one line separated by — (strip any icon characters like ï § #)",
  "summary": "the summary paragraph text only, no prefix",
  "skills": [
    {"category": "Category Name", "items": "item1, item2, item3"}
  ],
  "sections": [
    {
      "title": "Section Title (exact)",
      "entries": [
        {
          "left": "Main heading — company, degree, project name, award name",
          "right": "Date or date range",
          "sub1": "First subtitle line — job title or institution name (omit if absent)",
          "sub2": "Second subtitle — location or GPA (omit if absent)",
          "detail": "Extra line like specialisation or score (omit if absent)",
          "bullets": ["exact bullet text 1", "exact bullet text 2"]
        }
      ]
    }
  ]
}

Rules:
- "skills" is a separate top-level key, NOT inside sections
- "sections" preserves the original order (Education, Projects, Experience and Achievements, etc.)
- bullets is empty array [] for entries with no bullet points
- Omit sub1/sub2/detail keys entirely if not present in the original`,
      },
      { role: "user", content: resumeText.slice(0, 8000) },
    ],
    temperature: 0,
    max_tokens: 3000,
  });

  const text = response.choices[0]?.message?.content || "";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as StructuredResume;
  } catch {
    // fall through
  }
  return null;
}

// Step 2 of tailoring: only rewrite summary + bullet text — structure is locked
async function tailorStructure(
  groq: Groq,
  structure: StructuredResume,
  jobTitle: string,
  jobDescription: string,
  jobCompany: string
): Promise<StructuredResume> {
  const response = await callWithFallback(groq, {
    messages: [
      {
        role: "system",
        content: `You are a resume optimizer. You will receive a structured resume JSON and a target job posting.

Return the SAME JSON with ONLY these two types of changes:
1. "summary" — rewrite this paragraph to better match the target job. Stay factual, keep similar length, don't add invented experience.
2. "bullets" arrays — reword individual bullet points to naturally emphasise skills relevant to the job. Keep the SAME number of bullets. Keep the same factual events — only change wording and emphasis.

STRICT — do NOT change:
- name, contact, skills (categories or items), section titles, section order
- entry "left", "right", "sub1", "sub2", "detail" fields
- number of sections, entries, or bullets
- Do NOT invent any skill, role, technology, or achievement not in the original

Return ONLY valid JSON with the same structure. No commentary, no markdown fences.`,
      },
      {
        role: "user",
        content: `RESUME JSON:\n${JSON.stringify(structure, null, 2)}\n\nTARGET JOB:\nTitle: ${jobTitle}\nCompany: ${jobCompany}\nDescription: ${jobDescription.slice(0, 2000)}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 3000,
  });

  const text = response.choices[0]?.message?.content || "";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as StructuredResume;
  } catch {
    // fall through
  }
  return structure; // return original if tailoring parse fails
}

export async function tailorResume(
  apiKey: string,
  resumeText: string,
  jobTitle: string,
  jobDescription: string,
  jobCompany: string
): Promise<string> {
  const groq = createGroqClient(apiKey);

  // Parse into structure first so the LLM cannot restructure the resume
  const structure = await parseResumeToStructure(groq, resumeText);
  if (!structure) {
    // Fallback: single-step markdown (worse quality but better than failing)
    const resp = await callWithFallback(groq, {
      messages: [
        {
          role: "system",
          content: `Tailor this resume for the target job. Change ONLY the summary paragraph and bullet point wording. DO NOT change section order, headings, dates, company names, or add any skills not already present. Output clean markdown.`,
        },
        {
          role: "user",
          content: `RESUME:\n${resumeText.slice(0, 8000)}\n\nJOB:\nTitle: ${jobTitle}\nCompany: ${jobCompany}\nDescription: ${jobDescription.slice(0, 2000)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2500,
    });
    return resp.choices[0]?.message?.content || resumeText;
  }

  const tailored = await tailorStructure(groq, structure, jobTitle, jobDescription, jobCompany);
  return JSON.stringify(tailored);
}

export async function generateCoverLetter(
  apiKey: string,
  resumeText: string,
  jobTitle: string,
  jobDescription: string,
  jobCompany: string
): Promise<string> {
  const groq = createGroqClient(apiKey);

  const response = await callWithFallback(groq, {
    messages: [
      {
        role: "system",
        content: `You are an expert cover letter writer. Write a professional, compelling cover letter for the given job based on the candidate's resume.

Rules:
- Keep it concise (3-4 paragraphs)
- Highlight relevant experience and skills
- Show enthusiasm for the role and company
- Do NOT fabricate any information
- Output in clean text format`,
      },
      {
        role: "user",
        content: `RESUME:\n${resumeText.slice(0, 6000)}\n\nJOB:\nTitle: ${jobTitle}\nCompany: ${jobCompany}\nDescription: ${jobDescription.slice(0, 3000)}`,
      },
    ],
    temperature: 0.4,
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content || "";
}
