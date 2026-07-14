import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FormNotice, Notice } from "../../components/notice";

describe("semantic notice variants", () => {
  it("renders explanatory guidance as a polite warning", () => {
    const html = renderToStaticMarkup(createElement(Notice, { variant: "warning" }, "กรุณาตรวจสอบสถานะก่อนดำเนินการ"));

    expect(html).toContain("notice-warning");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it("renders validation failures as assertive errors", () => {
    const html = renderToStaticMarkup(createElement(FormNotice, { state: { message: "Validation failed" } }));

    expect(html).toContain("notice-error");
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
  });

  it("renders successful saves in the success variant", () => {
    const html = renderToStaticMarkup(createElement(FormNotice, { state: { message: "บันทึกเรียบร้อย", status: "success" } }));

    expect(html).toContain("notice-success");
    expect(html).toContain('role="status"');
  });
});
