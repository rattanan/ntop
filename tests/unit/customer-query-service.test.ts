import { describe, expect, it } from "vitest";

import {
  buildCustomerFilterWhere,
  buildCustomerScopeWhere,
  CustomerQueryValidationError,
  encodeCustomerCursor,
} from "../../lib/customer/customer-query-service";

describe("Customer query policy", () => {
  it("limits SELF scope to records owned by the actor", () => {
    expect(buildCustomerScopeWhere({actorId:"user-1",assignments:[{role:"KAM",scope:"SELF",organizationUnitId:null}]})).toEqual({OR:[{ownerId:"user-1"}]});
  });

  it("combines owned and assigned organization-unit scope", () => {
    expect(buildCustomerScopeWhere({actorId:"manager-1",assignments:[{role:"TEAM_MANAGER",scope:"ORG_UNIT",organizationUnitId:"org-1"}]})).toEqual({OR:[{ownerId:"manager-1"},{organizationUnitId:{in:["org-1"]}}]});
  });

  it("allows an explicit enterprise assignment to view all", () => {
    expect(buildCustomerScopeWhere({actorId:"executive-1",assignments:[{role:"EXECUTIVE",scope:"ENTERPRISE",organizationUnitId:null}]})).toEqual({});
  });

  it("uses bounded indexed-style filters instead of unbounded contains", () => {
    expect(buildCustomerFilterWhere({query:"0123456789012"})).toEqual({AND:[{OR:[{taxId:"0123456789012"}]}]});
    expect(buildCustomerFilterWhere({query:"Acme",segment:"Enterprise"})).toEqual({AND:[{OR:[{name:{startsWith:"Acme"}},{province:"Acme"},{externalIds:{some:{externalId:"Acme"}}}]},{segment:"Enterprise"}]});
  });

  it("rejects oversized query and produces opaque cursor text", () => {
    expect(()=>buildCustomerFilterWhere({query:"x".repeat(101)})).toThrow(CustomerQueryValidationError);
    expect(encodeCustomerCursor("customer-1")).not.toContain("customer-1");
  });
});
