import { describe, expect, it } from "vitest";

import {
  NAV_GROUPS,
  navigationLabel,
  visibleNavigation,
  visibleQuickCreate,
} from "../../components/app-navigation";
import {
  NAVIGATION_PERMISSIONS,
  QUICK_CREATE_PERMISSIONS,
} from "../../lib/authorization/navigation-permissions";

describe("permission-driven application navigation", () => {
  it("shows only modules granted by server-side permission configuration", () => {
    const groups = visibleNavigation([
      NAVIGATION_PERMISSIONS.contracts,
      NAVIGATION_PERMISSIONS.approvals,
    ]);
    const routes = groups.flatMap((group) => group.items.map((item) => item.href));

    expect(routes).toEqual(["/contracts", "/approvals"]);
    expect(routes).not.toContain("/prospects");
    expect(routes).not.toContain("/admin/users");
  });

  it("keeps Contract directly below Proposal in the Commercial menu", () => {
    const commercial = NAV_GROUPS.find((group) => group.label === "Commercial");
    const routes = commercial?.items.map((item) => item.href) ?? [];
    const proposalIndex = routes.indexOf("/proposals");

    expect(routes[proposalIndex + 1]).toBe("/contracts");
    expect(visibleNavigation([NAVIGATION_PERMISSIONS.contracts]).flatMap((group) => group.items.map((item) => item.href))).toEqual(["/contracts"]);
    expect(navigationLabel("/contracts/contract-1")).toBe("สัญญา");
  });

  it("allows audit navigation without exposing administration mutations", () => {
    const groups = visibleNavigation([NAVIGATION_PERMISSIONS.adminAudit]);
    const routes = groups.flatMap((group) => group.items.map((item) => item.href));

    expect(routes).toEqual(["/admin/audit"]);
  });

  it("exposes Quotation and Service Category administration through explicit grants", () => {
    const groups = visibleNavigation([
      NAVIGATION_PERMISSIONS.quotes,
      NAVIGATION_PERMISSIONS.adminServiceCategories,
    ]);
    expect(groups.flatMap((group) => group.items.map((item) => item.href))).toEqual([
      "/quotes",
      "/admin/service-categories",
      "/admin/solution-reference-data",
    ]);
  });

  it("filters quick create independently from read navigation", () => {
    const items = visibleQuickCreate([
      NAVIGATION_PERMISSIONS.prospects,
      QUICK_CREATE_PERMISSIONS.activity,
    ]);

    expect(items.map((item) => item.href)).toEqual(["/activities/new"]);
  });

  it("distinguishes proposal documents from commercial quotations", () => {
    const items = visibleQuickCreate([
      QUICK_CREATE_PERMISSIONS.proposal,
      QUICK_CREATE_PERMISSIONS.quote,
    ]);

    expect(items.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: "สร้างเอกสารข้อเสนอ (Proposal)", href: "/proposals/new" },
      { label: "สร้างใบเสนอราคา (Quotation)", href: "/quotes/new" },
    ]);
  });

  it("returns no protected modules when no permission was granted", () => {
    expect(visibleNavigation([])).toEqual([]);
    expect(visibleQuickCreate([])).toEqual([]);
  });
});
