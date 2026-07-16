import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("application version footer contract", () => {
  it("renders the package version in the portal sidebar footer", () => {
    const packageMetadata = JSON.parse(read("package.json")) as { version: string };
    const layout = read("app/(portal)/layout.tsx");
    const shell = read("components/app-shell.tsx");

    expect(packageMetadata.version).toBe("0.1.0");
    expect(layout).toContain("version={packageMetadata.version}");
    expect(shell).toContain('className="sidebar-version"');
    expect(shell).toContain("Version {version}");
  });
});
