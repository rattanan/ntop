import type { Prisma } from "@prisma/client";

import { authorizedOrganizationUnitIds, type AuthorizationContext } from "../authorization/authorization-context";
import { buildCustomerScopeWhere } from "../customer/customer-query-service";
import { buildLeadScopeWhere } from "../lead/prisma-lead-repository";
import { buildOpportunityScopeWhere } from "../opportunity/opportunity-query";
import { buildProspectOrganizationScopeWhere } from "../prospect/prospect-authorization";

export function buildActivityScopeWhere(context: AuthorizationContext): Prisma.ActivityWhereInput {
  const organizationUnitIds = authorizedOrganizationUnitIds(context);
  return {
    OR: [
      { ownerId: context.actorId, customerId: null, opportunityId: null, leadId: null, prospectId: null },
      ...(organizationUnitIds.length ? [
        { customer: buildCustomerScopeWhere(context) },
        { opportunity: buildOpportunityScopeWhere(context) },
        { lead: buildLeadScopeWhere(context) },
        { prospect: buildProspectOrganizationScopeWhere(context) },
      ] : []),
    ],
  };
}
