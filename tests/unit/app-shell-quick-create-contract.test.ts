import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const shell = readFileSync(resolve(process.cwd(), "components/app-shell.tsx"), "utf8");

describe("app shell quick create", () => {
  it("closes its disclosure after a destination is selected", () => {
    expect(shell).toContain('function closeQuickCreate(event: React.MouseEvent<HTMLAnchorElement>)');
    expect(shell).toContain('closest("details")?.removeAttribute("open")');
    expect(shell).toContain("onClick={closeQuickCreate}");
  });
});
