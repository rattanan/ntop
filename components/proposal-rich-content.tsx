import { sanitizeProposalHtml } from "@/lib/proposal/proposal-html";

export function ProposalRichContent({ content }: { content: string }) {
  const html = content.trim() ? sanitizeProposalHtml(content) : "<p>—</p>";
  return <div className="proposal-content proposal-rich-content" dangerouslySetInnerHTML={{ __html: html }} />;
}
