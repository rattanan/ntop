import { describe, expect, it } from "vitest";

import { sanitizeProposalHtml } from "../../lib/proposal/proposal-html";

describe("Proposal rich HTML", () => {
  it("preserves supported semantic formatting", () => {
    const result = sanitizeProposalHtml('<h2>หัวข้อ</h2><p>ข้อความ <strong>สำคัญ</strong></p><ul><li>รายการหนึ่ง</li></ul><table><tbody><tr><td>ข้อมูล</td></tr></tbody></table>');
    expect(result).toContain("<h2>หัวข้อ</h2>");
    expect(result).toContain("<strong>สำคัญ</strong>");
    expect(result).toContain("<ul><li>รายการหนึ่ง</li></ul>");
    expect(result).toContain("<table><tbody><tr><td>ข้อมูล</td></tr></tbody></table>");
  });

  it("removes executable markup, unsafe URLs, embeds, styles, and event handlers", () => {
    const result = sanitizeProposalHtml('<script>alert(1)</script><p style="color:red" onclick="alert(2)">Safe</p><a href="javascript:alert(3)">bad link</a><img src="https://tracker.example/pixel" onerror="alert(4)"><iframe src="https://evil.example"></iframe>');
    expect(result).toContain("<p>Safe</p>");
    expect(result).toContain("<a>bad link</a>");
    expect(result).not.toMatch(/script|javascript:|onclick|onerror|style=|<img|<iframe/i);
  });

  it("allows only explicit link protocols", () => {
    expect(sanitizeProposalHtml('<a href="https://example.com">web</a><a href="mailto:sales@example.com">mail</a>')).toBe('<a href="https://example.com">web</a><a href="mailto:sales@example.com">mail</a>');
  });
});
