import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const forms = readFileSync("components/forms.tsx", "utf8");
const detail = readFileSync("app/(portal)/opportunities/[id]/page.tsx", "utf8");
const action = readFileSync("app/actions/opportunity.ts", "utf8");

describe("Opportunity edit stage contract", () => {
  it("does not present stage as a directly editable profile field", () => {
    expect(forms).not.toContain('name="stage"');
    expect(forms).toContain('aria-label="ขั้นตอนขายปัจจุบัน"');
    expect(forms).toContain("ขั้นตอนขายเปลี่ยนผ่าน Transition");
  });

  it("links profile editing to the governed transition workflow", () => {
    expect(forms).toContain("#stage-transition");
    expect(detail).toContain('id="stage-transition"');
    expect(action).toContain("createOpportunityRuntime().transition");
    expect(action).toContain('text(form, "idempotencyKey")');
  });
});
