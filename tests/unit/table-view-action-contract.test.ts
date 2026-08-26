import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const tableViews = [
  "app/(portal)/activities/page.tsx",
  "app/(portal)/leads/page.tsx",
  "app/(portal)/products/page.tsx",
  "components/service-category-admin-console.tsx",
] as const;

describe("table view actions", () => {
  it.each(tableViews)("uses the standard eye icon and Thai label in %s", (path) => {
    const source = read(path);
    expect(source).toContain('className="row-action"');
    expect(source).toMatch(/aria-label=\{`ดู [^`]+`\}><Eye aria-hidden="true" \/>ดู<\/Link>/);
  });
});
