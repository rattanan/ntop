import { describe, expect, it } from "vitest";

import { pageNumberItems } from "../../components/page-number-navigation";

describe("pageNumberItems", () => {
  it("shows every page when the result set is small", () => {
    expect(pageNumberItems(2, 3)).toEqual([1, 2, 3]);
  });

  it("keeps first, nearby and last pages while condensing a large result set", () => {
    expect(pageNumberItems(8, 20)).toEqual([1, "ellipsis", 6, 7, 8, 9, 10, "ellipsis", 20]);
  });
});
