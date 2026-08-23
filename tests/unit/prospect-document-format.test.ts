import { describe, expect, it } from "vitest";

import { formatDocumentSize } from "../../lib/prospect/prospect-document-format";

describe("formatDocumentSize", () => {
  it("does not round non-empty small files down to zero megabytes", () => {
    expect(formatDocumentSize(3, "en-US")).toBe("3 B");
    expect(formatDocumentSize(42_500, "en-US")).toBe("42.5 KB");
    expect(formatDocumentSize(1_250_000, "en-US")).toBe("1.3 MB");
  });
});
