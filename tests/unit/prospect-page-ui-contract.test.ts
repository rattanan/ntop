import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(join(process.cwd(), "app/(portal)/prospects/page.tsx"), "utf8");
const form = readFileSync(join(process.cwd(), "components/prospect-form.tsx"), "utf8");

describe("Prospect page UI contract", () => {
  it("does not expose the raw column list as a text input", () => {
    expect(page).not.toContain("Column selector");
    expect(page).not.toContain('<input className="control" name="columns"');
    expect(page).not.toContain("<span>Columns</span>");
  });

  it("keeps the existing table columns and URL compatibility", () => {
    expect(page).toContain("const allColumns = [");
    expect(page).toContain('"code"');
    expect(page).toContain('"company"');
    expect(page).toContain('const columns = (query.columns ?? "")');
    expect(page).toContain("columns.map((column) => <th key={column}>{column}</th>)");
  });

  it("offers every mutable status without locking the transition order", () => {
    expect(form).toContain("mutableStatuses.map((value)");
    expect(form).not.toContain("PROSPECT_TRANSITIONS");
    expect(form).toContain('value !== "CONVERTED" && value !== "ARCHIVED"');
  });
});
