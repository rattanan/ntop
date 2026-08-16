import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app/dashboard.css"), "utf8");

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  const [red, green, blue] = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrast(foreground: string, background: string) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("dashboard dark-theme contrast", () => {
  it.each([
    ["shell primary text", "#f5f7fa", "#111318", 4.5],
    ["card primary text", "#f5f7fa", "#191c22", 4.5],
    ["shell secondary text", "#abb3bf", "#111318", 3],
    ["hero primary text", "#f8fafc", "#4b3e0a", 4.5],
    ["hero secondary text", "#e0d6aa", "#4b3e0a", 3],
  ])("keeps %s readable", (_label, foreground, background, minimum) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum);
  });

  it("applies semantic foreground tokens to the reported dark surfaces", () => {
    expect(css).toContain(':root[data-theme="dark"] {');
    expect(css).not.toMatch(/\n\[data-theme="dark"\] \{\s*\n\s*--background:/);
    expect(css).toContain("--dashboard-hero-foreground:#f8fafc");
    expect(css).toContain("--dashboard-hero-muted-foreground:#e0d6aa");
    expect(css).toContain(".dashboard-hero h1{margin:0;color:var(--dashboard-hero-foreground)");
    expect(css).toContain('[data-theme="dark"] .breadcrumb a');
    expect(css).toContain('[data-theme="dark"] .user-chip strong');
    expect(css).toContain('[data-theme="dark"] .sidebar-footer button{color:var(--foreground)}');
  });
});
