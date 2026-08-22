import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const modules = [
  { name: "activity", route: "activities", form: "ActivityEditForm", permission: "recordUpdate" },
  { name: "prospect", route: "prospects", form: "ProspectForm", permission: "prospectUpdate" },
  { name: "lead", route: "leads", form: "LeadEditForm", permission: "recordUpdate" },
  { name: "customer", route: "customers", form: "CustomerForm", permission: "recordUpdate" },
  { name: "opportunity", route: "opportunities", form: "OpportunityForm", permission: "recordUpdate" },
  { name: "proposal", route: "proposals", form: "ProposalEditor", permission: "proposalManage" },
] as const;

describe("record detail edit navigation", () => {
  for (const recordModule of modules) {
    it(`keeps ${recordModule.name} detail free of its core edit form`, () => {
      const detail = read(`app/(portal)/${recordModule.route}/[id]/page.tsx`);
      expect(detail).not.toContain(`<${recordModule.form}`);
      expect(detail).toContain("Pencil");
      expect(detail).toContain('href={`/' + recordModule.route + '/');
      expect(detail).toContain('/edit`}');
    });

    it(`renders the scoped ${recordModule.name} form on a dedicated edit page`, () => {
      const edit = read(`app/(portal)/${recordModule.route}/[id]/edit/page.tsx`);
      expect(edit).toContain(`<${recordModule.form}`);
      expect(edit).toContain(recordModule.permission);
      expect(edit).toContain("notFound()");
      expect(edit).toContain("กลับหน้ารายละเอียด");
    });
  }
});
