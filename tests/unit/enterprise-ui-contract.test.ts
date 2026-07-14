import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("enterprise UI contract", () => {
  it("provides keyboard-first global navigation without changing backend contracts", () => {
    const shell = read("components/app-shell.tsx");
    const palette = read("components/enterprise-command-palette.tsx");

    expect(shell).toContain('href="#main-content"');
    expect(shell).toContain('id="main-content"');
    expect(shell).toContain("EnterpriseCommandPalette");
    expect(palette).toContain('event.key.toLowerCase() === "k"');
    expect(palette).toContain('role="dialog"');
    expect(palette).toContain('aria-modal="true"');
    expect(palette).toContain('event.key === "Tab"');
  });

  it("keeps admin navigation role-aware and exposes quick create as navigation only", () => {
    const navigation = read("components/app-navigation.ts");
    const shell = read("components/app-shell.tsx");

    expect(navigation).toContain("adminOnly: true");
    expect(shell).toContain('user.role === "ADMIN"');
    expect(navigation).toContain("QUICK_CREATE_ITEMS");
    expect(shell).toContain("QUICK_CREATE_ITEMS.map");
    expect(shell).not.toContain("fetch(");
  });

  it("defines accessible enterprise tokens, sticky tables, and responsive fallbacks", () => {
    const css = read("app/globals.css");

    expect(css).toContain("--nt-yellow-500: #ffd200");
    expect(css).toContain("--button-height: 42px");
    expect(css).toContain(".table thead { position:sticky");
    expect(css).toContain("@media (max-width:600px)");
    expect(css).toContain("@media (prefers-reduced-motion:reduce)");
  });

  it("announces required fields and inline validation to assistive technology", () => {
    const field = read("components/form-field.tsx");

    expect(field).toContain('role="alert"');
    expect(field).toContain('className="sr-only"');
    expect(field).toContain("aria-invalid");
    expect(field).toContain("aria-describedby");
  });
});
