import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const dashboardCss = readFileSync(join(process.cwd(), "app/dashboard.css"), "utf8");
const globalCss = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

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
    ["card secondary text", "#abb3bf", "#191c22", 3],
    ["warning text", "#ffe58a", "#342d12", 4.5],
    ["danger text", "#ffb2ab", "#351c1d", 4.5],
    ["success text", "#91ddb0", "#173126", 4.5],
    ["info text", "#b6d6ff", "#172a40", 4.5],
    ["quick-create light interaction", "#5f4900", "#fffbea", 4.5],
    ["quick-create dark interaction", "#ffe58a", "#292719", 4.5],
    ["hero primary text", "#f8fafc", "#4b3e0a", 4.5],
    ["hero secondary text", "#e0d6aa", "#4b3e0a", 3],
    ["field-help tooltip text", "#30343b", "#fffdf2", 4.5],
  ])("keeps %s readable", (_label, foreground, background, minimum) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum);
  });

  it("applies semantic foreground tokens to the reported dark surfaces", () => {
    expect(dashboardCss).toContain(':root[data-theme="dark"] {');
    expect(dashboardCss).not.toMatch(/\n\[data-theme="dark"\] \{\s*\n\s*--background:/);
    expect(dashboardCss).toContain("--dashboard-hero-foreground:#f8fafc");
    expect(dashboardCss).toContain("--dashboard-hero-muted-foreground:#e0d6aa");
    expect(dashboardCss).toContain("--surface-input:#12161d");
    expect(dashboardCss).toContain(".dashboard-hero h1{margin:0;color:var(--dashboard-hero-foreground)");
    expect(dashboardCss).toContain('[data-theme="dark"] .breadcrumb a');
    expect(dashboardCss).toContain('[data-theme="dark"] .user-chip strong');
    expect(dashboardCss).toContain('[data-theme="dark"] .sidebar-footer button{color:var(--foreground)}');
  });

  it("keeps quick-create links readable in every interaction state", () => {
    expect(globalCss).toContain(".quick-create-menu a { min-height:42px;display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:var(--radius-sm);color:var(--foreground)");
    expect(globalCss).toContain(".quick-create-menu a:is(:hover,:focus-visible,:active) { background:var(--surface-hover);color:var(--on-warning); }");
    expect(globalCss).not.toContain(".quick-create-menu a:hover { background:#fff8d3; }");
  });

  it("keeps shared field-help tooltips readable in light and dark themes", () => {
    expect(globalCss).toContain("--field-help-tooltip-background: #fffdf2");
    expect(globalCss).toContain("--field-help-tooltip-foreground: #30343b");
    expect(globalCss).toContain("background:var(--field-help-tooltip-background);color:var(--field-help-tooltip-foreground)");
    expect(globalCss).toContain(".related-summary-help .field-help-tooltip { color:var(--field-help-tooltip-foreground)");
    expect(globalCss).not.toContain("background:#fffdf2;color:var(--nt-ink-800)");
  });

  it.each([
    ".card",
    ".module-tabs",
    ".customer-tabs",
    ".opportunity-tabs",
    ".control",
    ".table-wrap",
    ".table th",
    ".empty",
    ".confirm-dialog",
    ".command-dialog",
    ".help-card",
  ])("covers shared %s surfaces after feature rules", (selector) => {
    const darkParityStart = globalCss.indexOf("/* Dark theme parity");
    expect(darkParityStart).toBeGreaterThan(0);
    expect(globalCss.slice(darkParityStart)).toContain(selector);
  });
});
