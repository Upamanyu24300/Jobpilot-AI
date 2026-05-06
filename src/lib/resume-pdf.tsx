import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  type DocumentProps,
  type Styles,
} from "@react-pdf/renderer";
import type { StructuredResume } from "./groq";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 42,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#222",
    lineHeight: 1.35,
  },
  name: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 5,
  },
  contact: {
    fontSize: 8.5,
    textAlign: "center",
    color: "#444",
    marginBottom: 14,
    lineHeight: 1.5,
  },
  sectionHeader: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
    borderBottomWidth: 1,
    borderBottomColor: "#1e40af",
    paddingBottom: 2,
    marginTop: 12,
    marginBottom: 6,
  },
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  entryLeft: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
  },
  entryRight: {
    fontSize: 8.5,
    color: "#555",
  },
  entrySub: {
    fontSize: 9,
    fontFamily: "Helvetica-Oblique",
    color: "#333",
  },
  entryDetail: {
    fontSize: 8.5,
    color: "#555",
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 2,
    marginTop: 1,
  },
  bulletDot: {
    width: 12,
    marginTop: 0.5,
    fontSize: 9,
  },
  bulletText: {
    flex: 1,
    fontSize: 9,
  },
  skillRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  skillCategory: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginRight: 4,
  },
  skillItems: {
    flex: 1,
    fontSize: 9,
  },
  paragraph: {
    marginBottom: 3,
    fontSize: 9,
  },
  spacer: {
    marginBottom: 3,
  },
  mdName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 6,
  },
  mdSection: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: "#1e40af",
    borderBottomWidth: 1,
    borderBottomColor: "#1e40af",
    paddingBottom: 2,
    marginTop: 10,
    marginBottom: 5,
  },
  mdSubHeader: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    marginTop: 5,
    marginBottom: 2,
  },
});

// ─── Structured resume renderer ───────────────────────────────────────────────

function StructuredResumeDocument({ resume }: { resume: StructuredResume }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{resume.name}</Text>
        {resume.contact && (
          <>
            <Text style={styles.contact}>{resume.contact}</Text>
            <View style={{ borderBottomWidth: 0.5, borderBottomColor: "#cccccc", marginBottom: 2 }} />
          </>
        )}

        {resume.summary && (
          <>
            <Text style={styles.sectionHeader}>Summary</Text>
            <Text style={styles.paragraph}>{resume.summary}</Text>
          </>
        )}

        {resume.skills && resume.skills.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Skills</Text>
            {resume.skills.map((skill, i) => (
              <View key={i} style={styles.skillRow}>
                <Text style={styles.skillCategory}>{skill.category}:</Text>
                <Text style={styles.skillItems}>{skill.items}</Text>
              </View>
            ))}
          </>
        )}

        {resume.sections.map((section, si) => (
          <View key={si}>
            <Text style={styles.sectionHeader}>{section.title}</Text>
            {section.entries.map((entry, ei) => (
              <View key={ei} style={{ marginBottom: 7 }}>
                <View style={styles.entryRow}>
                  <Text style={styles.entryLeft}>{entry.left}</Text>
                  <Text style={styles.entryRight}>{entry.right}</Text>
                </View>
                {entry.sub1 && <Text style={styles.entrySub}>{entry.sub1}</Text>}
                {entry.sub2 && <Text style={styles.entryDetail}>{entry.sub2}</Text>}
                {entry.detail && <Text style={styles.entryDetail}>{entry.detail}</Text>}
                {entry.bullets.map((bullet, bi) => (
                  <View key={bi} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}

// ─── Markdown fallback renderer ───────────────────────────────────────────────

function InlineText({ text, style }: { text: string; style?: Styles[string] }) {
  const segments = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <Text style={style}>
      {segments.map((seg, i) => {
        if (seg.startsWith("**") && seg.endsWith("**")) {
          return <Text key={i} style={{ fontFamily: "Helvetica-Bold" }}>{seg.slice(2, -2)}</Text>;
        }
        if (seg.startsWith("*") && seg.endsWith("*")) {
          return <Text key={i} style={{ fontFamily: "Helvetica-Oblique" }}>{seg.slice(1, -1)}</Text>;
        }
        return seg;
      })}
    </Text>
  );
}

function MarkdownResumeDocument({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const blocks = lines.map((line, i) => {
    if (/^# /.test(line)) return <Text key={i} style={styles.mdName}>{line.slice(2).trim()}</Text>;
    if (/^## /.test(line)) return <Text key={i} style={styles.mdSection}>{line.slice(3).trim()}</Text>;
    if (/^### /.test(line)) return <InlineText key={i} text={line.slice(4).trim()} style={styles.mdSubHeader} />;
    if (/^[-*] /.test(line)) return (
      <View key={i} style={styles.bulletRow}>
        <Text style={styles.bulletDot}>•</Text>
        <InlineText text={line.slice(2).trim()} style={styles.bulletText} />
      </View>
    );
    if (line.trim() === "") return <View key={i} style={styles.spacer} />;
    return <InlineText key={i} text={line.trim()} style={styles.paragraph} />;
  });

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {blocks}
      </Page>
    </Document>
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function renderResumePDF(resumeData: string): Promise<Buffer> {
  let element: React.ReactElement<DocumentProps>;
  try {
    const parsed = JSON.parse(resumeData);
    if (parsed && parsed.name && Array.isArray(parsed.sections)) {
      element = React.createElement(StructuredResumeDocument, { resume: parsed as StructuredResume }) as React.ReactElement<DocumentProps>;
    } else {
      element = React.createElement(MarkdownResumeDocument, { markdown: resumeData }) as React.ReactElement<DocumentProps>;
    }
  } catch {
    element = React.createElement(MarkdownResumeDocument, { markdown: resumeData }) as React.ReactElement<DocumentProps>;
  }
  return renderToBuffer(element) as Promise<Buffer>;
}
