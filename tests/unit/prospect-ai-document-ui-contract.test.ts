import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("app/(portal)/prospects/[id]/page.tsx", "utf8");
const form = readFileSync("components/prospect-action-forms.tsx", "utf8");
const route = readFileSync("app/api/v1/prospects/[id]/documents/route.ts", "utf8");
const storage = readFileSync("lib/prospect/prospect-document-storage.ts", "utf8");
const css = readFileSync("app/globals.css", "utf8");

describe("Prospect AI insight and document upload contract", () => {
  it("renders three accessible score meters with explicit score meaning", () => {
    expect(page).toContain('role="meter"');
    expect(page).toContain('label="Opportunity"');
    expect(page).toContain('label="Risk"');
    expect(page).toContain('label="Confidence"');
    expect(page).toContain("คะแนนต่ำหมายถึงความเสี่ยงน้อย");
  });

  it("offers bounded multipart upload with loading and accessible feedback", () => {
    expect(form).toContain('type="file"');
    expect(form).toContain("10_000_000");
    expect(form).toContain('role={message.type === "error" ? "alert" : "status"}');
    expect(route).toContain("prospectActor");
    expect(route).toContain("prospectIdempotencyKey");
  });

  it("uses private S3-compatible storage and requires clean malware result", () => {
    expect(storage).toContain("AWS4-HMAC-SHA256");
    expect(storage).toContain('result.status !== "CLEAN"');
    expect(storage).not.toContain("writeFile");
    expect(css).toContain("@media (prefers-reduced-motion:reduce)");
  });
});
