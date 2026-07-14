import { describe, expect, it } from "vitest";

import {
  BangkokDateTimeError,
  parseBangkokDateTime,
} from "../../lib/ai/bangkok-date-time";

describe("parseBangkokDateTime", () => {
  it("stores timezone-less form values as the matching Bangkok instant", () => {
    expect(
      parseBangkokDateTime("2026-07-13T10:30")?.toISOString(),
    ).toBe("2026-07-13T03:30:00.000Z");
  });

  it("preserves explicit timezone offsets", () => {
    expect(
      parseBangkokDateTime("2026-07-13T10:30:00+09:00")?.toISOString(),
    ).toBe("2026-07-13T01:30:00.000Z");
  });

  it("returns null for an optional empty value and rejects malformed values", () => {
    expect(parseBangkokDateTime("")).toBeNull();
    expect(() => parseBangkokDateTime("not-a-date")).toThrow(
      BangkokDateTimeError,
    );
  });
});
