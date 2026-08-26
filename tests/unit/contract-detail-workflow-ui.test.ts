import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("app/(portal)/contracts/[id]/page.tsx", "utf8");
const controls = readFileSync("components/contract-workflow-controls.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");

describe("Contract detail workflow and evidence layout", () => {
  it("keeps the workflow panel visible when the actor has no available transition", () => {
    expect(controls).toContain('data-testid="contract-workflow-panel"');
    expect(controls).toContain("ยังไม่มี Transition ที่คุณดำเนินการได้");
    expect(controls).toContain("workflowUnavailableReason");
  });

  it("uses a balanced responsive control layout and documents upload constraints", () => {
    expect(controls).toContain('className="grid-2 contract-control-grid"');
    expect(controls).toContain('className="card contract-document-card"');
    expect(controls).toContain('accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"');
    expect(controls).toContain("ไฟล์ต้องมีขนาดไม่เกิน 25 MB");
    expect(controls).toContain("local private storage แบบเดียวกับเอกสาร Prospect");
    expect(css).toContain(".contract-control-grid { display:flex;");
    expect(css).toContain(".contract-document-form-grid");
  });

  it("does not show the verified signature evidence step", () => {
    expect(controls).not.toContain("Verified Signature Evidence");
    expect(controls).not.toContain('data-testid="contract-signature-submit"');
  });

  it("shows uploaded Contract document versions in a bounded server-side table", () => {
    expect(page).toContain('id="contract-documents"');
    expect(page).toContain("prisma.contractDocumentVersion.findMany");
    expect(page).toContain("take: documentPageSize");
    expect(page).toContain("documentSortKeys.has");
    expect(page).toContain("SortableTableHeader");
    expect(page).toContain("PageNumberNavigation");
    expect(page).toContain("ไม่พบเอกสาร");
  });

  it("allows owners to see permitted transitions without a maker-checker filter", () => {
    expect(page).not.toContain("edge.makerChecker && contract.ownerId === session.id");
    expect(page).not.toContain("หลัก maker-checker");
    expect(page).toContain("transitions={permittedTransitions.map");
    expect(page).toContain("ไม่มีสิทธิ์ส่งต่อสถานะ");
  });

  it("uses contract-specific responsive layouts instead of the proposal status grid", () => {
    expect(page).toContain('className="contract-overview-grid"');
    expect(page).toContain('className="card-body contract-version-list"');
    expect(page).toContain('className="card-body contract-evidence-grid"');
    expect(css).toContain(".contract-overview-grid { display:grid;");
    expect(css).toContain(".contract-evidence-grid span");
    expect(controls).toContain('className="contract-order-list"');
    expect(controls).not.toContain('className="proposal-status-cards"');
  });
});
