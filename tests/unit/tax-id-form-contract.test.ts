import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const formSources = [
  "components/forms.tsx",
  "components/prospect-form.tsx",
  "components/lead-form-fields.tsx",
  "components/lead-workflow-forms.tsx",
  "components/lead-detail-actions.tsx",
  "lib/form-field-metadata.ts",
].map((path) => readFileSync(path, "utf8"));

describe("juristic identifier form contract", () => {
  it("does not impose the former 13-digit browser validation in any form", () => {
    for (const source of formSources) {
      expect(source).not.toContain('[0-9]{13}');
      expect(source).not.toContain("13 หลัก");
    }
  });

  it("uses the shared juristic identifier label", () => {
    for (const source of formSources.slice(1, 5)) {
      expect(source).toContain("เลขนิติบุคคล");
    }
  });
});
