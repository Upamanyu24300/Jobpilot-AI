// Server-side PDF generation using a simple approach
// We'll generate a clean HTML resume and convert it to a downloadable format

export function generateResumeHTML(markdownResume: string, name: string): string {
  // Convert markdown to HTML-like structure
  let html = markdownResume;

  // Convert markdown headers
  html = html.replace(/^### (.+)$/gm, '<h3 style="color:#1a1a1a;font-size:14px;margin:12px 0 6px;border-bottom:1px solid #e0e0e0;padding-bottom:4px;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="color:#1a1a1a;font-size:16px;margin:16px 0 8px;border-bottom:2px solid #2563eb;padding-bottom:4px;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="color:#1a1a1a;font-size:22px;margin:0 0 4px;text-align:center;">$1</h1>');

  // Convert bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Convert bullet points
  html = html.replace(/^[*-] (.+)$/gm, '<li style="margin:2px 0;line-height:1.5;">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="margin:4px 0 8px 20px;padding:0;">$&</ul>');

  // Convert line breaks
  html = html.replace(/\n\n/g, "<br/>");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${name} - Resume</title>
<style>
  @page { margin: 0.6in; size: letter; }
  body {
    font-family: 'Segoe UI', Calibri, Arial, sans-serif;
    font-size: 11px;
    line-height: 1.4;
    color: #333;
    max-width: 750px;
    margin: 0 auto;
    padding: 40px;
  }
  a { color: #2563eb; text-decoration: none; }
  ul { list-style-type: disc; }
</style>
</head>
<body>
${html}
</body>
</html>`;
}

export function markdownToText(markdown: string): string {
  return markdown
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^[*-]\s+/gm, "• ")
    .trim();
}
